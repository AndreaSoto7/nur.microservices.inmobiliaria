package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.DomainException;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Aggregate aparte (ADR 0003): una propiedad guardada por un usuario. Referencia la propiedad por ID.
 * No publica eventos.
 */
public final class Favorite {

    private final FavoriteId id;
    private final UUID userId;
    private final PropertyId propertyId;
    private final Instant createdAt;

    private Favorite(FavoriteId id, UUID userId, PropertyId propertyId, Instant createdAt) {
        this.id = Objects.requireNonNull(id);
        this.userId = Objects.requireNonNull(userId);
        this.propertyId = Objects.requireNonNull(propertyId);
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    /** Solo se guarda una propiedad PUBLISHED. Que no se repita lo verifica el caso de uso (y la base). */
    public static Favorite save(UUID userId, PropertyId propertyId, PropertyStatus propertyStatus, Instant now) {
        if (propertyStatus != PropertyStatus.PUBLISHED) {
            throw new DomainException("FAVORITE_PROPERTY_NOT_PUBLISHED",
                    "Solo se pueden guardar propiedades publicadas");
        }
        return new Favorite(FavoriteId.newId(), userId, propertyId, now);
    }

    public static Favorite rehydrate(FavoriteId id, UUID userId, PropertyId propertyId, Instant createdAt) {
        return new Favorite(id, userId, propertyId, createdAt);
    }

    public FavoriteId id() {
        return id;
    }

    public UUID userId() {
        return userId;
    }

    public PropertyId propertyId() {
        return propertyId;
    }

    public Instant createdAt() {
        return createdAt;
    }
}
