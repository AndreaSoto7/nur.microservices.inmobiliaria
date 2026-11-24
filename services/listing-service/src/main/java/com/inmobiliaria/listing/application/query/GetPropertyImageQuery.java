package com.inmobiliaria.listing.application.query;

import java.util.UUID;

/** viewerId es el sub del token si llegó uno; null si la pidió un visitante anónimo. */
public record GetPropertyImageQuery(UUID propertyId, UUID imageId, UUID viewerId) {

    public static GetPropertyImageQuery anonymous(UUID propertyId, UUID imageId) {
        return new GetPropertyImageQuery(propertyId, imageId, null);
    }
}
