package com.inmobiliaria.listing.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "favorites")
public class FavoriteJpaEntity {

    @Id
    UUID id;

    @Column(name = "user_id", nullable = false)
    UUID userId;

    @Column(name = "property_id", nullable = false)
    UUID propertyId;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected FavoriteJpaEntity() {
    }

    FavoriteJpaEntity(UUID id, UUID userId, UUID propertyId, Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.propertyId = propertyId;
        this.createdAt = createdAt;
    }
}
