package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.query.CatalogCriteria;
import com.inmobiliaria.listing.application.query.CatalogReadModel;
import com.inmobiliaria.listing.application.query.GetCatalogPropertyHandler;
import com.inmobiliaria.listing.application.query.GetCatalogPropertyQuery;
import com.inmobiliaria.listing.application.query.SearchCatalogHandler;
import com.inmobiliaria.listing.application.query.SearchCatalogQuery;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyType;
import com.inmobiliaria.listing.presentation.rest.dto.PageResponse;
import com.inmobiliaria.listing.presentation.rest.dto.PropertyDetailResponse;
import com.inmobiliaria.listing.presentation.rest.dto.PropertySummaryResponse;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Catálogo público (lado query de CQRS): sin token, solo PUBLISHED y RESERVED. */
@RestController
@RequestMapping("/api/v1/catalog/properties")
public class CatalogController {

    private final SearchCatalogHandler search;
    private final GetCatalogPropertyHandler getOne;

    public CatalogController(SearchCatalogHandler search, GetCatalogPropertyHandler getOne) {
        this.search = search;
        this.getOne = getOne;
    }

    @GetMapping
    public PageResponse<PropertySummaryResponse> search(
            @RequestParam(required = false) String zone,
            @RequestParam(required = false) PropertyType type,
            @RequestParam(required = false) OperationType operation,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Integer bedrooms,
            @RequestParam(required = false) List<String> features,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) List<String> sort) {
        Set<Feature> wanted = EnumSet.noneOf(Feature.class);
        if (features != null) {
            features.stream().flatMap(f -> List.of(f.split(",")).stream()).map(String::trim)
                    .filter(f -> !f.isEmpty()).forEach(f -> wanted.add(Features.parse(f)));
        }
        CatalogCriteria criteria = CatalogCriteria.builder()
                .zone(zone)
                .propertyType(type)
                .operationType(operation)
                .priceBetween(minPrice, maxPrice)
                .minBedrooms(bedrooms)
                .withFeatures(wanted)
                .build();
        var result = search.handle(new SearchCatalogQuery(criteria,
                PageParams.of(page, size, sort, CatalogReadModel.SORTABLE_FIELDS)));
        return PageResponse.of(result, PropertySummaryResponse::from);
    }

    @GetMapping("/{propertyId}")
    public PropertyDetailResponse get(@PathVariable UUID propertyId) {
        return PropertyDetailResponse.from(getOne.handle(new GetCatalogPropertyQuery(new PropertyId(propertyId))));
    }
}
