package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.command.PropertyCommands.CreatePropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.EditPropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.UpdatePropertyFeaturesCommand;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Casos de uso que crean o cambian los datos de una propiedad. Cada uno: carga (o crea) el aggregate,
 * invoca su método (que valida la regla), guarda y registra los eventos en el outbox, todo en una
 * transacción. Los comandos no devuelven datos de lectura: crear devuelve solo el ID.
 */
@Service
public class PropertyCommandHandler {

    private final PropertyRepository repository;
    private final EventPublisher events;
    private final Clock clock;

    public PropertyCommandHandler(PropertyRepository repository, EventPublisher events, Clock clock) {
        this.repository = repository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public PropertyId handle(CreatePropertyCommand command) {
        Property property = Property.create(command.agentId(), command.title(), command.description(),
                command.type(), command.operation(), command.price(), command.location(), clock.instant());
        save(property);
        return property.id();
    }

    @Transactional
    public void handle(EditPropertyCommand command) {
        Property property = OwnedProperties.load(repository, command.propertyId(), command.agentId());
        property.edit(command.title(), command.description(), command.price(), command.location(), clock.instant());
        save(property);
    }

    @Transactional
    public void handle(UpdatePropertyFeaturesCommand command) {
        Property property = OwnedProperties.load(repository, command.propertyId(), command.agentId());
        property.updateFeatures(command.bedrooms(), command.bathrooms(), command.area(), command.features(),
                clock.instant());
        save(property);
    }

    private void save(Property property) {
        repository.save(property);
        events.publish(property, property.pullEvents());
    }
}
