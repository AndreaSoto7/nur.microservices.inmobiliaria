package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.query.CatalogCriteria;
import com.inmobiliaria.listing.domain.model.Feature;
import java.util.ArrayList;
import java.util.List;

/** Traduce CatalogCriteria a especificaciones SQL sobre property_catalog. */
final class CatalogSqlSpecifications {

    private CatalogSqlSpecifications() {
    }

    static List<SqlFilter> from(CatalogCriteria criteria) {
        List<SqlFilter> filters = new ArrayList<>();
        criteria.zone().ifPresent(zone -> filters.add(SqlFilter.of("zone_normalized = :zone", "zone", zone)));
        criteria.propertyType().ifPresent(type ->
                filters.add(SqlFilter.of("property_type = :propertyType", "propertyType", type.name())));
        criteria.operationType().ifPresent(operation ->
                filters.add(SqlFilter.of("operation_type = :operationType", "operationType", operation.name())));
        criteria.minPrice().ifPresent(min -> filters.add(SqlFilter.of("price_amount >= :minPrice", "minPrice", min)));
        criteria.maxPrice().ifPresent(max -> filters.add(SqlFilter.of("price_amount <= :maxPrice", "maxPrice", max)));
        criteria.minBedrooms().ifPresent(bedrooms ->
                filters.add(SqlFilter.of("bedrooms >= :minBedrooms", "minBedrooms", bedrooms)));
        if (!criteria.features().isEmpty()) {
            String[] features = criteria.features().stream().map(Feature::name).sorted().toArray(String[]::new);
            filters.add(SqlFilter.of("features @> CAST(:features AS varchar(30)[])", "features", features));
        }
        return filters;
    }
}
