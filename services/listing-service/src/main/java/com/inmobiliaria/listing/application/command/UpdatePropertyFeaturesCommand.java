package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.Set;

public record UpdatePropertyFeaturesCommand(PropertyId propertyId, int bedrooms, int bathrooms, Area area,
        Set<Feature> features, CommandMetadata metadata) {
}
