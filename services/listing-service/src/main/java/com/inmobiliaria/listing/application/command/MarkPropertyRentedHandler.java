package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** rentListingCommand: solo RENT, desde PUBLISHED o RESERVED. */
public class MarkPropertyRentedHandler {

    private final PropertyCommandSupport support;

    public MarkPropertyRentedHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(MarkPropertyRentedCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.markRented(support.now());
        support.commit(property, command.metadata());
    }
}
