package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Implementa EventPublisher con el patrón Outbox: inserta los eventos de integración en la tabla outbox,
 * dentro de la transacción del comando. Nunca publica en Kafka aquí: eso lo hace OutboxRelay.
 */
@Component
public class OutboxEventPublisher implements EventPublisher {

    private final PropertyIntegrationEventMapper mapper;
    private final NamedParameterJdbcTemplate jdbc;

    public OutboxEventPublisher(PropertyIntegrationEventMapper mapper, NamedParameterJdbcTemplate jdbc) {
        this.mapper = mapper;
        this.jdbc = jdbc;
    }

    @Override
    public void publish(Property property, List<? extends PropertyEvent> domainEvents, CommandMetadata metadata) {
        for (OutboxMessage message : mapper.toOutbox(property, domainEvents, metadata)) {
            jdbc.update("""
                    INSERT INTO outbox (id, topic, aggregate_id, envelope)
                    VALUES (:id, :topic, :aggregateId, CAST(:envelope AS jsonb))
                    """, Map.of("id", message.id(), "topic", message.topic(),
                    "aggregateId", message.aggregateId(), "envelope", message.envelope()));
        }
    }
}
