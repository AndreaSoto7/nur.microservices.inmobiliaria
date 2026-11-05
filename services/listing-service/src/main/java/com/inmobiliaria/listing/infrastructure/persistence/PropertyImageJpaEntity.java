package com.inmobiliaria.listing.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Fila de {@code property_images}. La posición 0 es la portada. */
@Entity
@Table(name = "property_images")
public class PropertyImageJpaEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id")
    private PropertyJpaEntity property;

    @Column(nullable = false)
    private short position;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "storage_key", nullable = false, unique = true)
    private String storageKey;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    protected PropertyImageJpaEntity() {
        // JPA
    }

    PropertyImageJpaEntity(UUID id, PropertyJpaEntity property, short position, String contentType, int sizeBytes,
            String storageKey, Instant uploadedAt) {
        this.id = id;
        this.property = property;
        this.position = position;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.storageKey = storageKey;
        this.uploadedAt = uploadedAt;
    }

    UUID getId() { return id; }
    short getPosition() { return position; }
    void setPosition(short position) { this.position = position; }
    String getContentType() { return contentType; }
    int getSizeBytes() { return sizeBytes; }
    String getStorageKey() { return storageKey; }
    Instant getUploadedAt() { return uploadedAt; }
}
