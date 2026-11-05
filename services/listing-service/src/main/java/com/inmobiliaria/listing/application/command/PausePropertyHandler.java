package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** pauseListingCommand: PUBLISHED → PAUSED. */
public class PausePropertyHandler {

    private final PropertyCommandSupport support;

    public PausePropertyHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(PausePropertyCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.pause(support.now());
        support.commit(property, command.metadata());
    }
}
