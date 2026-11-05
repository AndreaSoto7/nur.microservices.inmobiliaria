package com.inmobiliaria.listing.application.exception;

import com.inmobiliaria.listing.domain.model.PropertyId;

/** La propiedad no existe, o quien pregunta no debe saber que existe (→ 404). */
public class PropertyNotFoundException extends ApplicationException {

    public PropertyNotFoundException(PropertyId id) {
        super("PROPERTY_NOT_FOUND", "No existe la propiedad " + id);
    }
}
