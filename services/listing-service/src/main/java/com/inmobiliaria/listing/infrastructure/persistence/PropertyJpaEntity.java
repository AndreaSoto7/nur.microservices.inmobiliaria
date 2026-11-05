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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Entidad de persistencia de Property. No es el modelo de dominio: PropertyMapper traduce entre ambos. */
@Entity
@Table(name = "properties")
public class PropertyJpaEntity {

    @Id
    UUID id;

    @Column(name = "agent_id", nullable = false)
    UUID agentId;

    @Column(nullable = false, length = 150)
    String title;

    @Column(nullable = false, length = 5000)
    String description;

    @Column(name = "property_type", nullable = false, length = 20)
    String propertyType;

    @Column(name = "operation_type", nullable = false, length = 10)
    String operationType;

    @Column(nullable = false, length = 20)
    String status;

    @Column(name = "price_amount", nullable = false, precision = 14, scale = 2)
    BigDecimal priceAmount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "price_currency", nullable = false, length = 3)
    String priceCurrency;

    @Column(nullable = false, length = 100)
    String zone;

    @Column(length = 255)
    String address;

    @Column(precision = 9, scale = 6)
    BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    BigDecimal longitude;

    Short bedrooms;

    Short bathrooms;

    @Column(name = "area_m2", precision = 10, scale = 2)
    BigDecimal areaM2;

    @Column(name = "published_at")
    Instant publishedAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    /** Bloqueo optimista: el agente y la política LeadClosed pueden tocar la misma propiedad a la vez. */
    @Version
    long version;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "property_features", joinColumns = @JoinColumn(name = "property_id"))
    @Column(name = "feature", length = 30)
    Set<String> features = new HashSet<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "property_id", nullable = false)
    @OrderBy("position")
    List<PropertyImageJpaEntity> images = new ArrayList<>();

    protected PropertyJpaEntity() {
    }

    PropertyJpaEntity(UUID id) {
        this.id = id;
    }
}
