package com.inmobiliaria.listing.application.policy;

import java.util.UUID;

/**
 * Lo que listing necesita saber de un LeadClosed de visit, ya traducido a su propio modelo
 * (anti-corruption layer). No reutiliza clases de visit.
 */
public record LeadClosedNotification(UUID eventId, UUID leadId, UUID propertyId, UUID agentId, Outcome outcome,
        String correlationId) {

    public enum Outcome {
        WON,
        LOST
    }
}
