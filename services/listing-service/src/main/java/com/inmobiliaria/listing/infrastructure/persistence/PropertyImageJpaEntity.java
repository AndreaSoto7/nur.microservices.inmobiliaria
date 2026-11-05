package com.inmobiliaria.listing.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "property_images")
public class PropertyImageJpaEntity {

    @Id
    UUID id;

    @Column(nullable = false)
    Short position;

    @Column(name = "content_type", nullable = false, length = 20)
    String contentType;

    @Column(name = "size_bytes", nullable = false)
    Integer sizeBytes;

    @Column(name = "storage_key", nullable = false, unique = true, length = 255)
    String storageKey;

    @Column(name = "uploaded_at", nullable = false)
    Instant uploadedAt;

    protected PropertyImageJpaEntity() {
    }

    PropertyImageJpaEntity(UUID id, short position, String contentType, int sizeBytes, String storageKey,
            Instant uploadedAt) {
        this.id = id;
        this.position = position;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.storageKey = storageKey;
        this.uploadedAt = uploadedAt;
    }
}
