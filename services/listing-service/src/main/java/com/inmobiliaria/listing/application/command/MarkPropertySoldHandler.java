package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** buyListingCommand: solo SALE, desde PUBLISHED o RESERVED. Irreversible. */
public class MarkPropertySoldHandler {

    private final PropertyCommandSupport support;

    public MarkPropertySoldHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(MarkPropertySoldCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.markSold(support.now());
        support.commit(property, command.metadata());
    }
}
