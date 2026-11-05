package com.inmobiliaria.listing.infrastructure.messaging;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Fila de {@code outbox}: un evento de integración listo para publicar (patrón Outbox). */
@Entity
@Table(name = "outbox")
public class OutboxJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String topic;

    @Column(name = "aggregate_id", nullable = false, length = 36)
    private String aggregateId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String envelope;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    protected OutboxJpaEntity() {
        // JPA
    }

    OutboxJpaEntity(UUID id, String topic, String aggregateId, String envelope, Instant createdAt) {
        this.id = id;
        this.topic = topic;
        this.aggregateId = aggregateId;
        this.envelope = envelope;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getTopic() { return topic; }
    public String getAggregateId() { return aggregateId; }
    public String getEnvelope() { return envelope; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    void markPublished(Instant when) { this.publishedAt = when; }
}
