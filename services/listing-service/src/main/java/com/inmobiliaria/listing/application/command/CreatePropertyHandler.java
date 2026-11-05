package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import org.springframework.transaction.annotation.Transactional;

/** createListingCommand: la propiedad nace en DRAFT, a nombre del agente que la crea. */
public class CreatePropertyHandler {

    private final PropertyCommandSupport support;

    public CreatePropertyHandler(PropertyCommandSupport support) {
        this.support = support;
    }

    @Transactional
    public PropertyId handle(CreatePropertyCommand command) {
        Property property = Property.create(command.metadata().userId(), command.title(), command.description(),
                command.propertyType(), command.operationType(), command.price(), command.location(),
                support.now());
        support.commit(property, command.metadata());
        return property.id();
    }
}
