package com.inmobiliaria.listing.application.policy;

import java.time.Instant;
import java.util.UUID;

/**
 * Lo que listing necesita saber de las visitas de visit, ya traducido a su propio modelo (anti-corruption
 * layer): que una visita quedó programada para una propiedad, o que dejó de estarlo.
 */
public record VisitScheduleChange(UUID eventId, Kind kind, UUID visitId, UUID propertyId, Instant scheduledEnd,
        String correlationId) {

    public enum Kind {
        /** VisitScheduled: hay una visita confirmada hasta scheduledEnd. */
        SCHEDULED,
        /** VisitCancelled o VisitCompleted: la visita ya no está confirmada. */
        ENDED
    }
}
