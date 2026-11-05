package com.inmobiliaria.listing.presentation.rest.dto;

import com.inmobiliaria.listing.application.query.PropertyDetailView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PropertyDetailResponse(
        UUID id,
        UUID agentId,
        String title,
        String description,
        String propertyType,
        String operationType,
        String status,
        MoneyDto price,
        LocationDto location,
        Integer bedrooms,
        Integer bathrooms,
        BigDecimal areaM2,
        List<String> features,
        List<ImageResponse> images,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {

    public record ImageResponse(UUID id, int position, String url) {
    }

    public static PropertyDetailResponse from(PropertyDetailView v) {
        return new PropertyDetailResponse(v.id(), v.agentId(), v.title(), v.description(), v.propertyType(),
                v.operationType(), v.status(), new MoneyDto(v.priceAmount(), v.priceCurrency()),
                new LocationDto(v.zone(), v.address(), v.latitude(), v.longitude()), v.bedrooms(), v.bathrooms(),
                v.areaM2(), v.features(),
                v.images().stream().map(i -> new ImageResponse(i.id(), i.position(), i.url())).toList(),
                v.publishedAt(), v.createdAt(), v.updatedAt());
    }
}
