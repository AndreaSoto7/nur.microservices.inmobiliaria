package com.inmobiliaria.listing.application.port;

import com.inmobiliaria.listing.domain.model.PropertyId;
import java.time.Instant;
import java.util.UUID;

/**
 * Copia local de las visitas confirmadas de cada propiedad, alimentada por visit.visit.events. Solo la
 * escribe la política que consume esos eventos; los comandos de listing la leen.
 */
public interface ScheduledVisits {

    void track(UUID visitId, UUID propertyId, Instant scheduledEnd);

    void untrack(UUID visitId);

    /** Si la propiedad tiene una visita confirmada que todavía no terminó. */
    boolean hasUpcoming(PropertyId propertyId, Instant now);
}
