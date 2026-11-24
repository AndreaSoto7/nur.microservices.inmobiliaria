package com.inmobiliaria.listing.application.policy;

import com.inmobiliaria.listing.application.port.ProcessedEventStore;
import com.inmobiliaria.listing.application.port.ScheduledVisits;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lleva la copia local de visitas confirmadas (CQRS entre servicios, como la copia de propiedades de visit).
 * Idempotente: un evento repetido no cambia nada. Con ella, listing no deja pausar una propiedad que tiene
 * una visita confirmada (arreglos de la revisión).
 */
public class TrackScheduledVisitsPolicy {

    private static final Logger log = LoggerFactory.getLogger(TrackScheduledVisitsPolicy.class);

    private final ProcessedEventStore processedEvents;
    private final ScheduledVisits scheduledVisits;

    public TrackScheduledVisitsPolicy(ProcessedEventStore processedEvents, ScheduledVisits scheduledVisits) {
        this.processedEvents = processedEvents;
        this.scheduledVisits = scheduledVisits;
    }

    @Transactional
    public void handle(VisitScheduleChange change) {
        if (!processedEvents.markProcessed(change.eventId(), "Visit" + change.kind())) {
            log.debug("Evento de visita {} ya procesado: se descarta el duplicado", change.eventId());
            return;
        }
        switch (change.kind()) {
            case SCHEDULED -> scheduledVisits.track(change.visitId(), change.propertyId(), change.scheduledEnd());
            case ENDED -> scheduledVisits.untrack(change.visitId());
            default -> throw new IllegalStateException("Tipo de cambio desconocido: " + change.kind());
        }
    }
}
