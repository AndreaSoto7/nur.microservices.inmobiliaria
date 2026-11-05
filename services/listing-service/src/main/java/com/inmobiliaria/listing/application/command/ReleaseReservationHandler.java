package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** cancelListingCommand: RESERVED → PUBLISHED. */
public class ReleaseReservationHandler {

    private final PropertyCommandSupport support;

    public ReleaseReservationHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(ReleaseReservationCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.releaseReservation(support.now());
        support.commit(property, command.metadata());
    }
}
