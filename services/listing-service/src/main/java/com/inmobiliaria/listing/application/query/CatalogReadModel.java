package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageRequest;
import com.inmobiliaria.listing.application.common.PageResult;
import java.util.Set;

/** Lectura de la proyección property_catalog (lado query de CQRS). */
public interface CatalogReadModel {

    /** Campos por los que se puede ordenar el catálogo. */
    Set<String> SORTABLE_FIELDS = Set.of("price", "publishedAt", "areaM2", "bedrooms");

    PageResult<PropertySummaryView> search(CatalogCriteria criteria, PageRequest page);
}
