package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.PropertyId;

public record MarkPropertyRentedCommand(PropertyId propertyId, CommandMetadata metadata) {
}
