package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.port.CatalogProjection;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mantenimiento del lado query de CQRS: vacía property_catalog y lo vuelve a llenar desde el aggregate
 * Property, por si la proyección se desincronizó. No cambia ninguna propiedad ni publica eventos.
 * Corre en una sola transacción: el catálogo nunca queda a medio reconstruir. Devuelve cuántas
 * propiedades revisó, solo para el log.
 */
public class RebuildCatalogHandler {

    private final PropertyRepository properties;
    private final CatalogProjection catalog;

    public RebuildCatalogHandler(PropertyRepository properties, CatalogProjection catalog) {
        this.properties = properties;
        this.catalog = catalog;
    }

    @Transactional
    public int handle() {
        catalog.clear();
        List<PropertyId> ids = properties.findAllIds();
        ids.forEach(id -> properties.findById(id).ifPresent(catalog::sync));
        return ids.size();
    }
}
