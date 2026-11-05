package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageRequest;

public record SearchCatalogQuery(CatalogCriteria criteria, PageRequest page) {
}
