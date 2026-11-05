package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.MarkPropertyRentedCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.MarkPropertySoldCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PausePropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PublishPropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.ReleaseReservationCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.ReservePropertyCommand;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orquesta las transiciones: carga la propiedad del agente, invoca el método del aggregate (que es el
 * que valida la regla), guarda y registra los eventos. Una transacción, un aggregate.
 */
@Service
public class ChangePropertyStatusHandler {

    private final PropertyRepository repository;
    private final EventPublisher events;
    private final Clock clock;

    public ChangePropertyStatusHandler(PropertyRepository repository, EventPublisher events, Clock clock) {
        this.repository = repository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public void handle(ChangePropertyStatusCommand command) {
        Property property = OwnedProperties.load(repository, command.propertyId(), command.agentId());
        Instant now = clock.instant();
        switch (command) {
            case PublishPropertyCommand c -> property.publish(now);
            case PausePropertyCommand c -> property.pause(now);
            case ReservePropertyCommand c -> property.reserve(c.actor(), now);
            case ReleaseReservationCommand c -> property.releaseReservation(now);
            case MarkPropertySoldCommand c -> property.markSold(now);
            case MarkPropertyRentedCommand c -> property.markRented(now);
        }
        repository.save(property);
        events.publish(property, property.pullEvents());
    }
}
