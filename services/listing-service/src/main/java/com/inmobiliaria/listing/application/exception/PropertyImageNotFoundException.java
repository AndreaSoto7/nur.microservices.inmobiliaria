package com.inmobiliaria.listing.application.exception;

import java.util.UUID;

/** La propiedad existe pero no tiene esa imagen (→ 404). */
public class PropertyImageNotFoundException extends ApplicationException {

    public PropertyImageNotFoundException(UUID imageId) {
        super("PROPERTY_IMAGE_NOT_FOUND", "La propiedad no tiene la imagen " + imageId);
    }
}
