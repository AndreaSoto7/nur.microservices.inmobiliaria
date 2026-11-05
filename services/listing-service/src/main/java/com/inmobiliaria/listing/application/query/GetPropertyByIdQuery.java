package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.UUID;

public record GetPropertyByIdQuery(PropertyId propertyId, UUID requesterId) {
}
