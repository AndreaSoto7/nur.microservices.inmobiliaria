package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Modelos de lectura (lado query de CQRS). Tienen la forma de las respuestas de
 * contracts/openapi/listing-service.yaml, así que la API los devuelve tal cual.
 */
public final class PropertyViews {

    private PropertyViews() {}

    public record MoneyView(BigDecimal amount, String currency) {}

    public record LocationView(String zone, String address, BigDecimal latitude, BigDecimal longitude) {}

    public record ImageView(UUID id, String url, String contentType) {}

    public record PropertyDetailView(UUID id, UUID agentId, String title, String description,
            PropertyType propertyType, OperationType operationType, PropertyStatus status, MoneyView price,
            LocationView location, Integer bedrooms, Integer bathrooms, BigDecimal areaM2, List<Feature> features,
            List<ImageView> images, Instant publishedAt, Instant createdAt, Instant updatedAt) {}

    public record PropertySummaryView(UUID id, String title, PropertyType propertyType, OperationType operationType,
            PropertyStatus status, MoneyView price, String zone, String coverImageUrl, Instant updatedAt) {}

    public record PageMeta(int number, int size, long totalElements, int totalPages) {}

    public record PageView<T>(List<T> data, PageMeta page) {}

    /** Ruta pública de una imagen, relativa al gateway. Es la misma que viaja en los eventos. */
    public static String imageUrl(UUID propertyId, UUID imageId) {
        return "/api/v1/properties/" + propertyId + "/images/" + imageId;
    }
}
