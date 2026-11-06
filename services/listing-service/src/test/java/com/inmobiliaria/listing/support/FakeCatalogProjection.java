package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.port.CatalogProjection;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.HashMap;
import java.util.Map;

/** Guarda el estado con el que quedó cada propiedad en el catálogo. */
public class FakeCatalogProjection implements CatalogProjection {

    public final Map<PropertyId, PropertyStatus> rows = new HashMap<>();

    @Override
    public void sync(Property property) {
        if (property.status().isVisibleInCatalog()) {
            rows.put(property.id(), property.status());
        } else {
            rows.remove(property.id());
        }
    }

    @Override
    public void clear() {
        rows.clear();
    }
}
