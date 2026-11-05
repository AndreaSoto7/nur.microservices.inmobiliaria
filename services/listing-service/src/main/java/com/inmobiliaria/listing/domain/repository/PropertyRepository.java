package com.inmobiliaria.listing.domain.repository;

import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.Optional;

/** Puerto del aggregate Property: guarda y recupera el aggregate completo (con galería y extras). */
public interface PropertyRepository {

    Optional<Property> findById(PropertyId id);

    void save(Property property);
}
