package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import org.springframework.transaction.annotation.Transactional;

/** Detalle para el agente dueño, en cualquier estado. A otro agente le responde 404: no sabe que existe. */
public class GetPropertyByIdHandler {

    private final PropertyRepository properties;

    public GetPropertyByIdHandler(PropertyRepository properties) {
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public PropertyDetailView handle(GetPropertyByIdQuery query) {
        return properties.findById(query.propertyId())
                .filter(p -> p.isOwnedBy(query.requesterId()))
                .map(PropertyDetailView::from)
                .orElseThrow(() -> new PropertyNotFoundException(query.propertyId()));
    }
}
