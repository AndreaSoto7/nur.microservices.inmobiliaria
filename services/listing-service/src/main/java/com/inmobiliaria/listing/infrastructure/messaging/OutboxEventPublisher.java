package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.infrastructure.messaging.PropertyIntegrationEvents.IntegrationEvent;
import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Adapter del puerto EventPublisher con el patrón Outbox: inserta el envelope en la tabla outbox, en
 * la misma transacción que la propiedad. Nunca publica en Kafka aquí: lo hace el relay después del
 * commit (rule eventos-kafka).
 */
@Component
public class OutboxEventPublisher implements EventPublisher {

    static final String PRODUCER = "listing-service";
    static final String AGGREGATE_TYPE = "Property";

    private final EntityManager entityManager;
    private final ObjectMapper json;
    private final Clock clock;

    public OutboxEventPublisher(EntityManager entityManager, ObjectMapper json, Clock clock) {
        this.entityManager = entityManager;
        this.json = json;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void publish(Property source, List<? extends PropertyEvent> domainEvents) {
        for (PropertyEvent event : domainEvents) {
            PropertyIntegrationEvents.from(event, source).ifPresent(integration -> {
                UUID eventId = UUID.randomUUID();
                String envelope = json.writeValueAsString(envelope(eventId, event, integration));
                entityManager.persist(new OutboxJpaEntity(eventId, PropertyIntegrationEvents.TOPIC,
                        source.id().toString(), envelope, clock.instant()));
            });
        }
    }

    /** contracts/events/envelope.schema.json */
    private static Map<String, Object> envelope(UUID eventId, PropertyEvent event, IntegrationEvent integration) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", eventId.toString());
        envelope.put("eventType", integration.type());
        envelope.put("eventVersion", 1);
        envelope.put("occurredAt", event.occurredAt().toString());
        envelope.put("producer", PRODUCER);
        envelope.put("aggregateType", AGGREGATE_TYPE);
        envelope.put("aggregateId", event.propertyId().toString());
        envelope.put("correlationId", correlationId());
        envelope.put("payload", integration.payload());
        return envelope;
    }

    /** El de la request HTTP; si el comando no vino por HTTP, uno nuevo. */
    private static String correlationId() {
        String fromRequest = MDC.get(CorrelationIdFilter.MDC_KEY);
        return fromRequest != null ? fromRequest : UUID.randomUUID().toString();
    }
}
