package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageResult;
import org.springframework.transaction.annotation.Transactional;

/** Catálogo público: solo PUBLISHED y RESERVED, con filtros combinables. */
public class SearchCatalogHandler {

    private final CatalogReadModel catalog;

    public SearchCatalogHandler(CatalogReadModel catalog) {
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public PageResult<PropertySummaryView> handle(SearchCatalogQuery query) {
        return catalog.search(query.criteria(), query.page());
    }
}
