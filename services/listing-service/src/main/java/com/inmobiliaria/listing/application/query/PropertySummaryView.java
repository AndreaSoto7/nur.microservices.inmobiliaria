package com.inmobiliaria.listing.application.query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Fila de un listado: catálogo público, propiedades del agente o favoritos. */
public record PropertySummaryView(
        UUID id,
        String title,
        String propertyType,
        String operationType,
        String status,
        BigDecimal priceAmount,
        String priceCurrency,
        String zone,
        Integer bedrooms,
        Integer bathrooms,
        BigDecimal areaM2,
        List<String> features,
        String coverImageUrl,
        Instant publishedAt,
        Instant updatedAt) {
}
