package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.port.ScheduledVisits;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class InMemoryScheduledVisits implements ScheduledVisits {

    public record Visit(UUID propertyId, Instant scheduledEnd) {
    }

    public final Map<UUID, Visit> visits = new HashMap<>();

    @Override
    public void track(UUID visitId, UUID propertyId, Instant scheduledEnd) {
        visits.put(visitId, new Visit(propertyId, scheduledEnd));
    }

    @Override
    public void untrack(UUID visitId) {
        visits.remove(visitId);
    }

    @Override
    public boolean hasUpcoming(PropertyId propertyId, Instant now) {
        return visits.values().stream()
                .anyMatch(v -> v.propertyId().equals(propertyId.value()) && v.scheduledEnd().isAfter(now));
    }
}
