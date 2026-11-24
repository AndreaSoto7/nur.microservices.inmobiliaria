package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.exception.PropertyImageNotFoundException;
import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** Ordenar la galería (y elegir la portada): solo el dueño, y no si está vendida o alquilada. */
public class MovePropertyImageHandler {

    private final PropertyCommandSupport support;

    public MovePropertyImageHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(MovePropertyImageCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        boolean hasImage = property.images().stream().anyMatch(image -> image.id().equals(command.imageId()));
        if (!hasImage) {
            throw new PropertyImageNotFoundException(command.imageId());
        }
        property.moveImage(command.imageId(), command.position(), support.now());
        support.commit(property, command.metadata());
    }
}
