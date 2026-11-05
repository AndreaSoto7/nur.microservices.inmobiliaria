package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.query.PropertyViews;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyCreated;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyImagesAdded;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyPaused;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyPublished;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyRented;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyReserved;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertySold;
import com.inmobiliaria.listing.domain.event.PropertyEvent.PropertyUpdated;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Traduce los eventos de dominio a los payloads de contracts/events/listing/*.v1.schema.json (los
 * eventos de dominio son internos; estos son el contrato). PropertyCreated y PropertyImagesAdded no
 * salen del servicio.
 */
final class PropertyIntegrationEvents {

    static final String TOPIC = "listing.property.events";

    record IntegrationEvent(String type, Map<String, Object> payload) {}

    private PropertyIntegrationEvents() {}

    static Optional<IntegrationEvent> from(PropertyEvent event, Property property) {
        return switch (event) {
            case PropertyCreated e -> Optional.empty();
            case PropertyImagesAdded e -> Optional.empty();
            case PropertyPublished e -> {
                Map<String, Object> payload = fullState(property);
                payload.put("status", "PUBLISHED");
                payload.put("previousStatus", e.previousStatus().name());
                yield Optional.of(new IntegrationEvent("PropertyPublished", payload));
            }
            case PropertyUpdated e -> Optional.of(new IntegrationEvent("PropertyUpdated", fullState(property)));
            case PropertyPaused e -> Optional.of(new IntegrationEvent("PropertyPaused", stateChange(property, "PAUSED")));
            case PropertyReserved e -> {
                Map<String, Object> payload = stateChange(property, "RESERVED");
                // El aggregate ya garantiza que es AGENT o SYSTEM (un CLIENT no reserva).
                payload.put("actor", e.actor().name());
                yield Optional.of(new IntegrationEvent("PropertyReserved", payload));
            }
            case PropertySold e -> {
                Map<String, Object> payload = stateChange(property, "SOLD");
                payload.put("operationType", "SALE");
                yield Optional.of(new IntegrationEvent("PropertySold", payload));
            }
            case PropertyRented e -> {
                Map<String, Object> payload = stateChange(property, "RENTED");
                payload.put("operationType", "RENT");
                yield Optional.of(new IntegrationEvent("PropertyRented", payload));
            }
        };
    }

    /** Event-carried state transfer: lo que visit y el catálogo necesitan para no llamar por HTTP. */
    private static Map<String, Object> fullState(Property property) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("propertyId", property.id().toString());
        payload.put("agentId", property.agentId().toString());
        payload.put("title", property.title());
        payload.put("description", property.description());
        payload.put("propertyType", property.type().name());
        payload.put("operationType", property.operation().name());
        payload.put("price", Map.of("amount", property.price().amount(), "currency", property.price().currency()));
        payload.put("location", location(property.location()));
        payload.put("bedrooms", property.bedrooms().orElseThrow());
        payload.put("bathrooms", property.bathrooms().orElseThrow());
        payload.put("areaM2", property.area().orElseThrow().squareMeters());
        payload.put("features", property.features().stream().map(Feature::name).toList());
        List<String> imageUrls = property.images().stream()
                .map(image -> imageUrl(property, image))
                .toList();
        payload.put("coverImageUrl", imageUrls.isEmpty() ? null : imageUrls.getFirst());
        payload.put("imageUrls", imageUrls);
        payload.put("status", property.status().name());
        payload.put("publishedAt", property.publishedAt().orElseThrow().toString());
        return payload;
    }

    private static Map<String, Object> stateChange(Property property, String status) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("propertyId", property.id().toString());
        payload.put("agentId", property.agentId().toString());
        payload.put("status", status);
        return payload;
    }

    /** Los campos opcionales se omiten: el schema no acepta null en address ni en las coordenadas. */
    private static Map<String, Object> location(Location location) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("zone", location.zone());
        if (location.address() != null) result.put("address", location.address());
        if (location.latitude() != null) {
            result.put("latitude", location.latitude());
            result.put("longitude", location.longitude());
        }
        return result;
    }

    private static String imageUrl(Property property, PropertyImage image) {
        return PropertyViews.imageUrl(property.id().value(), image.id());
    }
}
