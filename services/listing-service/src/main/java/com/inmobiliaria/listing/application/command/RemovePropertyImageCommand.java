package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.UUID;

public record RemovePropertyImageCommand(PropertyId propertyId, UUID imageId, CommandMetadata metadata) {
}
