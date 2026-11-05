package com.inmobiliaria.listing.application.port;

import com.inmobiliaria.listing.domain.model.Property;

/**
 * Lado query de CQRS: mantiene la tabla property_catalog en la misma transacción que el comando.
 * Si la propiedad está PUBLISHED o RESERVED hace upsert; si no, la borra del catálogo.
 */
public interface CatalogProjection {

    void sync(Property property);
}
