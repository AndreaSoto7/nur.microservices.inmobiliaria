package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.port.ScheduledVisits;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Copia local de visitas confirmadas en scheduled_visits. */
@Component
public class JdbcScheduledVisits implements ScheduledVisits {

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcScheduledVisits(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void track(UUID visitId, UUID propertyId, Instant scheduledEnd) {
        jdbc.update("""
                INSERT INTO scheduled_visits (visit_id, property_id, scheduled_end) VALUES (:visit, :property, :end)
                ON CONFLICT (visit_id) DO UPDATE SET property_id = EXCLUDED.property_id,
                    scheduled_end = EXCLUDED.scheduled_end
                """, Map.of("visit", visitId, "property", propertyId, "end", Timestamp.from(scheduledEnd)));
    }

    @Override
    public void untrack(UUID visitId) {
        jdbc.update("DELETE FROM scheduled_visits WHERE visit_id = :visit", Map.of("visit", visitId));
    }

    @Override
    public boolean hasUpcoming(PropertyId propertyId, Instant now) {
        Boolean upcoming = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM scheduled_visits WHERE property_id = :property AND scheduled_end > :now)
                """, Map.of("property", propertyId.value(), "now", Timestamp.from(now)), Boolean.class);
        return Boolean.TRUE.equals(upcoming);
    }
}
