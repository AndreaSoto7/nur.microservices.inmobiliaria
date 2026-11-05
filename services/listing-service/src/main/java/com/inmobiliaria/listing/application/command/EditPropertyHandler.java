package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** editListingCommand: solo el agente dueño, y no si está vendida o alquilada. */
public class EditPropertyHandler {

    private final PropertyCommandSupport support;

    public EditPropertyHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(EditPropertyCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.edit(command.title(), command.description(), command.price(), command.location(), support.now());
        support.commit(property, command.metadata());
    }
}
