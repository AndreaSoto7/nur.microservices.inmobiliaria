package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.ImageUrls;
import com.inmobiliaria.listing.domain.model.Amenity;
import com.inmobiliaria.listing.domain.model.Property;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Detalle completo de una propiedad (vista del agente y detalle público del catálogo). */
public record PropertyDetailView(
        UUID id,
        UUID agentId,
        String title,
        String description,
        String propertyType,
        String operationType,
        String status,
        BigDecimal priceAmount,
        String priceCurrency,
        String zone,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        Integer bedrooms,
        Integer bathrooms,
        BigDecimal areaM2,
        List<String> features,
        List<ImageView> images,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {

    public record ImageView(UUID id, int position, String url) {
    }

    public static PropertyDetailView from(Property p) {
        UUID id = p.id().value();
        List<ImageView> images = new ArrayList<>();
        for (int position = 0; position < p.images().size(); position++) {
            UUID imageId = p.images().get(position).id();
            images.add(new ImageView(imageId, position, ImageUrls.of(id, imageId)));
        }
        return new PropertyDetailView(id, p.agentId(), p.title(), p.description(), p.type().name(),
                p.operation().name(), p.status().name(), p.price().amount(), p.price().currency(),
                p.location().zone(), p.location().address(), p.location().latitude(), p.location().longitude(),
                p.bedrooms().orElse(null), p.bathrooms().orElse(null),
                p.area().map(a -> a.squareMeters()).orElse(null),
                p.amenities().stream().map(Amenity::name).sorted().toList(), images,
                p.publishedAt().orElse(null), p.createdAt(), p.updatedAt());
    }
}
