package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/** registerPropertiesCommand: dormitorios, baños, superficie y extras. */
public class UpdatePropertyCharacteristicsHandler {

    private final PropertyCommandSupport support;

    public UpdatePropertyCharacteristicsHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public void handle(UpdatePropertyCharacteristicsCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        property.updateCharacteristics(command.bedrooms(), command.bathrooms(), command.area(), command.amenities(),
                support.now());
        support.commit(property, command.metadata());
    }
}
