package com.inmobiliaria.listing.application.common;

import java.util.UUID;

/** Rutas relativas al gateway de las imágenes (formato de los eventos y de la API). */
public final class ImageUrls {

    private ImageUrls() {
    }

    public static String of(UUID propertyId, UUID imageId) {
        return "/api/v1/properties/" + propertyId + "/images/" + imageId;
    }
}
