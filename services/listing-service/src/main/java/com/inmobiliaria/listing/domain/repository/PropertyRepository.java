package com.inmobiliaria.listing.domain.repository;

import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.Optional;

/** Un repositorio por aggregate: guarda y recupera la propiedad completa (con extras y galería). */
public interface PropertyRepository {

    Optional<Property> findById(PropertyId id);

    /**
     * Guarda la propiedad. Si otra operación la cambió desde que se cargó, lanza
     * {@link com.inmobiliaria.listing.domain.exception.ConcurrentPropertyModificationException}.
     */
    void save(Property property);
}
