package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import org.springframework.transaction.annotation.Transactional;

/** Detalle público: solo si la propiedad está PUBLISHED o RESERVED. */
public class GetCatalogPropertyHandler {

    private final PropertyRepository properties;

    public GetCatalogPropertyHandler(PropertyRepository properties) {
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public PropertyDetailView handle(GetCatalogPropertyQuery query) {
        return properties.findById(query.propertyId())
                .filter(p -> p.status().isListed())
                .map(PropertyDetailView::from)
                .orElseThrow(() -> new PropertyNotFoundException(query.propertyId()));
    }
}
