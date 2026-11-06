package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Amenity;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.Set;

public record UpdatePropertyCharacteristicsCommand(PropertyId propertyId, int bedrooms, int bathrooms, Area area,
        Set<Amenity> amenities, CommandMetadata metadata) {
}
