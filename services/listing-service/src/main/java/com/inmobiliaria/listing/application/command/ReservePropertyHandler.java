package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** reserveListingCommand: PUBLISHED → RESERVED. También lo usa la política LeadClosed (actor SYSTEM). */
public class ReservePropertyHandler {

    private final PropertyCommandSupport support;

    public ReservePropertyHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(ReservePropertyCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.reserve(command.metadata().actor(), support.now());
        support.commit(property, command.metadata());
    }
}
