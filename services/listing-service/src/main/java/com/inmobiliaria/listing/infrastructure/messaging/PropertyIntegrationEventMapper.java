package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.common.ImageUrls;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyCreated;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyImagesAdded;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyPaused;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyPublished;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyRented;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyReserved;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertySold;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyUpdated;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Amenity;
import com.inmobiliaria.listing.domain.model.Property;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Traduce los eventos de dominio de Property a los eventos de integración de contracts/events/listing/,
 * con el estado actual del aggregate. Así el modelo interno puede cambiar sin romper a visit ni a audit.
 * PropertyCreated es interno. Editar datos, características o galería de una propiedad del catálogo
 * (PUBLISHED o RESERVED) publica PropertyUpdated, una sola vez por comando; fuera del catálogo no se publica.
 */
@Component
public class PropertyIntegrationEventMapper {

    public static final String TOPIC = "listing.property.events";
    static final String PRODUCER = "listing-service";
    static final String AGGREGATE_TYPE = "Property";
    static final int VERSION = 1;

    private final JsonMapper json;

    public PropertyIntegrationEventMapper(JsonMapper json) {
        this.json = json;
    }

    /**
     * Traduce los eventos de un comando. Varias ediciones o imágenes en el mismo comando dan un solo
     * PropertyUpdated: el payload es el estado completo, así que repetirlo no le aporta nada a visit.
     */
    public List<OutboxMessage> toOutbox(Property property, List<? extends PropertyEvent> events,
            CommandMetadata metadata) {
        List<OutboxMessage> messages = new ArrayList<>();
        boolean updatedSent = false;
        for (PropertyEvent event : events) {
            boolean isUpdate = event instanceof PropertyUpdated || event instanceof PropertyImagesAdded;
            if (isUpdate && updatedSent) {
                continue;
            }
            Optional<OutboxMessage> message = toOutbox(property, event, metadata);
            message.ifPresent(messages::add);
            updatedSent |= isUpdate && message.isPresent();
        }
        return messages;
    }

    public Optional<OutboxMessage> toOutbox(Property property, PropertyEvent event, CommandMetadata metadata) {
        return switch (event) {
            case PropertyCreated ignored -> Optional.empty();
            case PropertyImagesAdded added -> updated(property, added, metadata);
            case PropertyUpdated updated -> updated(property, updated, metadata);
            case PropertyPublished published -> {
                Map<String, Object> payload = fullPayload(property);
                payload.put("status", "PUBLISHED");
                payload.put("previousStatus", published.previousStatus().name());
                yield Optional.of(envelope("PropertyPublished", property, published, payload, metadata));
            }
            case PropertyPaused paused -> Optional.of(envelope("PropertyPaused", property, paused,
                    statusPayload(property, "PAUSED"), metadata));
            case PropertyReserved reserved -> {
                Map<String, Object> payload = statusPayload(property, "RESERVED");
                payload.put("actor", reserved.actor().name());
                yield Optional.of(envelope("PropertyReserved", property, reserved, payload, metadata));
            }
            case PropertySold sold -> {
                Map<String, Object> payload = statusPayload(property, "SOLD");
                payload.put("operationType", property.operation().name());
                yield Optional.of(envelope("PropertySold", property, sold, payload, metadata));
            }
            case PropertyRented rented -> {
                Map<String, Object> payload = statusPayload(property, "RENTED");
                payload.put("operationType", property.operation().name());
                yield Optional.of(envelope("PropertyRented", property, rented, payload, metadata));
            }
        };
    }

    private Optional<OutboxMessage> updated(Property property, PropertyEvent event, CommandMetadata metadata) {
        return property.status().isVisibleInCatalog()
                ? Optional.of(envelope("PropertyUpdated", property, event, fullPayload(property), metadata))
                : Optional.empty();
    }

    /** Estado completo (event-carried state transfer): PropertyPublished y PropertyUpdated. */
    private static Map<String, Object> fullPayload(Property p) {
        UUID id = p.id().value();
        List<String> imageUrls = p.images().stream().map(i -> ImageUrls.of(id, i.id())).toList();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("propertyId", id.toString());
        payload.put("agentId", p.agentId().toString());
        payload.put("title", p.title());
        payload.put("description", p.description());
        payload.put("propertyType", p.type().name());
        payload.put("operationType", p.operation().name());
        payload.put("price", Map.of("amount", p.price().amount(), "currency", p.price().currency()));
        payload.put("location", location(p));
        payload.put("bedrooms", p.bedrooms().orElse(null));
        payload.put("bathrooms", p.bathrooms().orElse(null));
        payload.put("areaM2", p.area().map(Area::squareMeters).orElse(null));
        payload.put("features", p.amenities().stream().map(Amenity::name).sorted().toList());
        payload.put("coverImageUrl", imageUrls.isEmpty() ? null : imageUrls.getFirst());
        payload.put("imageUrls", imageUrls);
        payload.put("status", p.status().name());
        payload.put("publishedAt", p.publishedAt().map(PropertyIntegrationEventMapper::iso).orElse(null));
        return payload;
    }

    /** Lo mínimo que piden los schemas de cambio de estado. */
    private static Map<String, Object> statusPayload(Property p, String status) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("propertyId", p.id().value().toString());
        payload.put("agentId", p.agentId().toString());
        payload.put("status", status);
        return payload;
    }

    private static Map<String, Object> location(Property p) {
        Map<String, Object> location = new LinkedHashMap<>();
        location.put("zone", p.location().zone());
        if (p.location().address() != null) {
            location.put("address", p.location().address());
        }
        if (p.location().latitude() != null) {
            location.put("latitude", p.location().latitude());
            location.put("longitude", p.location().longitude());
        }
        return location;
    }

    private OutboxMessage envelope(String eventType, Property property, PropertyEvent event,
            Map<String, Object> payload, CommandMetadata metadata) {
        UUID eventId = UUID.randomUUID();
        String aggregateId = property.id().value().toString();
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", eventId.toString());
        envelope.put("eventType", eventType);
        envelope.put("eventVersion", VERSION);
        envelope.put("occurredAt", iso(event.occurredAt()));
        envelope.put("producer", PRODUCER);
        envelope.put("aggregateType", AGGREGATE_TYPE);
        envelope.put("aggregateId", aggregateId);
        envelope.put("correlationId", metadata.correlationId());
        envelope.put("causationId", metadata.causationId() == null ? null : metadata.causationId().toString());
        envelope.put("payload", payload);
        return new OutboxMessage(eventId, TOPIC, aggregateId, json.writeValueAsString(envelope));
    }

    private static String iso(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MILLIS).toString();
    }
}
