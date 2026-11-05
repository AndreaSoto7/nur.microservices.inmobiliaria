package com.inmobiliaria.listing.infrastructure.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Fila de {@code properties} con sus extras y su galería. No es el modelo de dominio: el mapper la
 * traduce a {@link com.inmobiliaria.listing.domain.model.Property} y de vuelta.
 */
@Entity
@Table(name = "properties")
public class PropertyJpaEntity {

    @Id
    private UUID id;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 5000)
    private String description;

    @Column(name = "property_type", nullable = false, length = 20)
    private String propertyType;

    @Column(name = "operation_type", nullable = false, length = 10)
    private String operationType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "price_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal priceAmount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "price_currency", nullable = false, length = 3)
    private String priceCurrency;

    @Column(nullable = false, length = 100)
    private String zone;

    private String address;

    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    private Short bedrooms;

    private Short bathrooms;

    @Column(name = "area_m2", precision = 10, scale = 2)
    private BigDecimal areaM2;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    // BatchSize: en el listado, las colecciones de 50 propiedades salen en una consulta y no en 50 (N+1).
    @BatchSize(size = 50)
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "property_features", joinColumns = @JoinColumn(name = "property_id"))
    @Column(name = "feature", length = 30)
    private Set<String> features = new HashSet<>();

    @BatchSize(size = 50)
    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("position")
    private List<PropertyImageJpaEntity> images = new ArrayList<>();

    protected PropertyJpaEntity() {
        // JPA
    }

    PropertyJpaEntity(UUID id) {
        this.id = id;
    }

    UUID getId() { return id; }
    UUID getAgentId() { return agentId; }
    void setAgentId(UUID agentId) { this.agentId = agentId; }
    String getTitle() { return title; }
    void setTitle(String title) { this.title = title; }
    String getDescription() { return description; }
    void setDescription(String description) { this.description = description; }
    String getPropertyType() { return propertyType; }
    void setPropertyType(String propertyType) { this.propertyType = propertyType; }
    String getOperationType() { return operationType; }
    void setOperationType(String operationType) { this.operationType = operationType; }
    String getStatus() { return status; }
    void setStatus(String status) { this.status = status; }
    BigDecimal getPriceAmount() { return priceAmount; }
    void setPriceAmount(BigDecimal priceAmount) { this.priceAmount = priceAmount; }
    String getPriceCurrency() { return priceCurrency; }
    void setPriceCurrency(String priceCurrency) { this.priceCurrency = priceCurrency; }
    String getZone() { return zone; }
    void setZone(String zone) { this.zone = zone; }
    String getAddress() { return address; }
    void setAddress(String address) { this.address = address; }
    BigDecimal getLatitude() { return latitude; }
    void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    BigDecimal getLongitude() { return longitude; }
    void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    Short getBedrooms() { return bedrooms; }
    void setBedrooms(Short bedrooms) { this.bedrooms = bedrooms; }
    Short getBathrooms() { return bathrooms; }
    void setBathrooms(Short bathrooms) { this.bathrooms = bathrooms; }
    BigDecimal getAreaM2() { return areaM2; }
    void setAreaM2(BigDecimal areaM2) { this.areaM2 = areaM2; }
    Instant getPublishedAt() { return publishedAt; }
    void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    Instant getCreatedAt() { return createdAt; }
    void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    Instant getUpdatedAt() { return updatedAt; }
    void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    Long getVersion() { return version; }
    Set<String> getFeatures() { return features; }
    List<PropertyImageJpaEntity> getImages() { return images; }
}
