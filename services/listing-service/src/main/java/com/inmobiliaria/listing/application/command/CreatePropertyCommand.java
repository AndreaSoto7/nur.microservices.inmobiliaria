package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyType;

public record CreatePropertyCommand(String title, String description, PropertyType propertyType,
        OperationType operationType, Money price, Location location, CommandMetadata metadata) {
}
