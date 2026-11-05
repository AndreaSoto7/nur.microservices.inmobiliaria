package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Filtros del catálogo público. Todos son opcionales y combinables, por eso se arman con un Builder
 * (patrón Builder): el controlador solo agrega los que llegaron.
 */
public final class CatalogCriteria {

    private final String zone;
    private final PropertyType propertyType;
    private final OperationType operationType;
    private final BigDecimal minPrice;
    private final BigDecimal maxPrice;
    private final Integer minBedrooms;
    private final Set<Feature> features;

    private CatalogCriteria(Builder builder) {
        this.zone = builder.zone;
        this.propertyType = builder.propertyType;
        this.operationType = builder.operationType;
        this.minPrice = builder.minPrice;
        this.maxPrice = builder.maxPrice;
        this.minBedrooms = builder.minBedrooms;
        this.features = builder.features.isEmpty() ? Set.of() : Set.copyOf(builder.features);
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Zona normalizada (minúsculas, sin espacios en los bordes), igual que zone_normalized. */
    public Optional<String> zone() {
        return Optional.ofNullable(zone);
    }

    public Optional<PropertyType> propertyType() {
        return Optional.ofNullable(propertyType);
    }

    public Optional<OperationType> operationType() {
        return Optional.ofNullable(operationType);
    }

    public Optional<BigDecimal> minPrice() {
        return Optional.ofNullable(minPrice);
    }

    public Optional<BigDecimal> maxPrice() {
        return Optional.ofNullable(maxPrice);
    }

    /** Dormitorios mínimos: "bedrooms=3" devuelve las de 3 o más. */
    public Optional<Integer> minBedrooms() {
        return Optional.ofNullable(minBedrooms);
    }

    /** La propiedad debe tener todas estas características. */
    public Set<Feature> features() {
        return features;
    }

    public static final class Builder {

        private String zone;
        private PropertyType propertyType;
        private OperationType operationType;
        private BigDecimal minPrice;
        private BigDecimal maxPrice;
        private Integer minBedrooms;
        private final Set<Feature> features = EnumSet.noneOf(Feature.class);

        private Builder() {
        }

        public Builder zone(String zone) {
            this.zone = zone == null || zone.isBlank() ? null : zone.trim().toLowerCase(Locale.ROOT);
            return this;
        }

        public Builder propertyType(PropertyType propertyType) {
            this.propertyType = propertyType;
            return this;
        }

        public Builder operationType(OperationType operationType) {
            this.operationType = operationType;
            return this;
        }

        public Builder priceBetween(BigDecimal min, BigDecimal max) {
            if (min != null && min.signum() < 0 || max != null && max.signum() < 0) {
                throw new IllegalArgumentException("Los precios del filtro no pueden ser negativos");
            }
            if (min != null && max != null && min.compareTo(max) > 0) {
                throw new IllegalArgumentException("minPrice no puede ser mayor que maxPrice");
            }
            this.minPrice = min;
            this.maxPrice = max;
            return this;
        }

        public Builder minBedrooms(Integer bedrooms) {
            if (bedrooms != null && bedrooms < 0) {
                throw new IllegalArgumentException("bedrooms no puede ser negativo");
            }
            this.minBedrooms = bedrooms;
            return this;
        }

        public Builder withFeatures(Set<Feature> features) {
            if (features != null) {
                this.features.addAll(features);
            }
            return this;
        }

        public CatalogCriteria build() {
            return new CatalogCriteria(this);
        }
    }
}
