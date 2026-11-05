package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.UUID;

public record AddFavoriteCommand(UUID userId, PropertyId propertyId) {
}
