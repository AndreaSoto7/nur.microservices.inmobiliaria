package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.List;

public record AddPropertyImagesCommand(PropertyId propertyId, List<byte[]> images, CommandMetadata metadata) {

    public AddPropertyImagesCommand {
        images = List.copyOf(images);
    }
}
