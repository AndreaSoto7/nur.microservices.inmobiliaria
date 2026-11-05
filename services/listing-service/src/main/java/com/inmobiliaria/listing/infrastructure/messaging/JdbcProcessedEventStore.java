package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.port.ProcessedEventStore;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class JdbcProcessedEventStore implements ProcessedEventStore {

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcProcessedEventStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean markProcessed(UUID eventId, String eventType) {
        return jdbc.update("""
                INSERT INTO processed_events (event_id, event_type) VALUES (:id, :type)
                ON CONFLICT (event_id) DO NOTHING
                """, Map.of("id", eventId, "type", eventType)) == 1;
    }
}
