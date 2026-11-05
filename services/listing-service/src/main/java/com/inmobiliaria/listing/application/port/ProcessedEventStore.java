package com.inmobiliaria.listing.application.port;

import java.util.UUID;

/** Idempotencia de los consumidores: tabla processed_events. */
public interface ProcessedEventStore {

    /** Registra el evento. Devuelve false si ya estaba registrado (es un duplicado). */
    boolean markProcessed(UUID eventId, String eventType);
}
