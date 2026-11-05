package com.inmobiliaria.listing.application.query;

import java.util.UUID;

public record GetPropertyImageQuery(UUID propertyId, UUID imageId) {
}
