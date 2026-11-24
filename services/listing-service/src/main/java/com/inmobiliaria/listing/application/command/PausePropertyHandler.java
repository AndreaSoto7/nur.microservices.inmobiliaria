package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.port.ScheduledVisits;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.model.Property;
import org.springframework.transaction.annotation.Transactional;

/**
 * pauseListingCommand: PUBLISHED → PAUSED. No se pausa una propiedad con una visita confirmada que todavía
 * no terminó: el interesado ya tiene día y hora. Las visitas las conoce por la copia local (ScheduledVisits).
 */
public class PausePropertyHandler {

    private final PropertyCommandSupport support;
    private final ScheduledVisits scheduledVisits;

    public PausePropertyHandler(PropertyCommandSupport support, ScheduledVisits scheduledVisits) {
        this.support = support;
        this.scheduledVisits = scheduledVisits;
    }

    @Transactional
    public void handle(PausePropertyCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        if (scheduledVisits.hasUpcoming(property.id(), support.now())) {
            throw new DomainException("PROPERTY_HAS_SCHEDULED_VISITS",
                    "La propiedad tiene visitas confirmadas: cancélalas o espera a que pasen antes de pausarla");
        }
        property.pause(support.now());
        support.commit(property, command.metadata());
    }
}
