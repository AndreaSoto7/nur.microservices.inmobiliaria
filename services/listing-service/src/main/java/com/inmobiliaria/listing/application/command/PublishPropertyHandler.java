package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** publishListingCommand: DRAFT o PAUSED → PUBLISHED (al menos 1 foto y datos completos). */
public class PublishPropertyHandler {

    private final PropertyCommandSupport support;

    public PublishPropertyHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(PublishPropertyCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.publish(support.now());
        support.commit(property, command.metadata());
    }
}
