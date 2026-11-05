package com.inmobiliaria.listing.presentation.rest.dto;

import com.inmobiliaria.listing.application.query.PropertySummaryView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PropertySummaryResponse(
        UUID id,
        String title,
        String propertyType,
        String operationType,
        String status,
        MoneyDto price,
        String zone,
        Integer bedrooms,
        Integer bathrooms,
        BigDecimal areaM2,
        List<String> features,
        String coverImageUrl,
        Instant publishedAt,
        Instant updatedAt) {

    public static PropertySummaryResponse from(PropertySummaryView v) {
        return new PropertySummaryResponse(v.id(), v.title(), v.propertyType(), v.operationType(), v.status(),
                new MoneyDto(v.priceAmount(), v.priceCurrency()), v.zone(), v.bedrooms(), v.bathrooms(),
                v.areaM2(), v.features(), v.coverImageUrl(), v.publishedAt(), v.updatedAt());
    }
}
