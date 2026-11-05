package com.inmobiliaria.listing.application.common;

import com.inmobiliaria.listing.domain.model.Actor;
import java.util.Objects;
import java.util.UUID;

/**
 * Quién ejecuta el comando y su trazabilidad. {@code userId} es el sub del JWT; es null cuando el actor es
 * SYSTEM (una política). {@code causationId} es el eventId que causó el comando, si lo hubo.
 */
public record CommandMetadata(Actor actor, UUID userId, String correlationId, UUID causationId) {

    public CommandMetadata {
        Objects.requireNonNull(actor);
        Objects.requireNonNull(correlationId);
        if (actor != Actor.SYSTEM && userId == null) {
            throw new IllegalArgumentException("Un comando de usuario necesita el id del usuario");
        }
    }

    public static CommandMetadata agent(UUID userId, String correlationId) {
        return new CommandMetadata(Actor.AGENT, userId, correlationId, null);
    }

    public static CommandMetadata client(UUID userId, String correlationId) {
        return new CommandMetadata(Actor.CLIENT, userId, correlationId, null);
    }

    public static CommandMetadata system(String correlationId, UUID causationId) {
        return new CommandMetadata(Actor.SYSTEM, null, correlationId, causationId);
    }

    public boolean isSystem() {
        return actor == Actor.SYSTEM;
    }
}
