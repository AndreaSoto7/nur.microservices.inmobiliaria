package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.port.ProcessedEventStore;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class InMemoryProcessedEventStore implements ProcessedEventStore {

    public final Set<UUID> processed = new HashSet<>();

    @Override
    public boolean markProcessed(UUID eventId, String eventType) {
        return processed.add(eventId);
    }
}
