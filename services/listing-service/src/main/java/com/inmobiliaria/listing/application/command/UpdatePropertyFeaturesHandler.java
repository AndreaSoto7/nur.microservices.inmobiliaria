package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** registerPropertiesCommand: dormitorios, baños, superficie y extras. */
public class UpdatePropertyFeaturesHandler {

    private final PropertyCommandSupport support;

    public UpdatePropertyFeaturesHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(UpdatePropertyFeaturesCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.updateFeatures(command.bedrooms(), command.bathrooms(), command.area(), command.features(),
                support.now());
        support.commit(property, command.metadata());
    }
}
