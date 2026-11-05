package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.PropertyId;

public record EditPropertyCommand(PropertyId propertyId, String title, String description, Money price,
        Location location, CommandMetadata metadata) {
}
