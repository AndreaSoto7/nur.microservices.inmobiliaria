package com.inmobiliaria.listing.application.policy;

import com.inmobiliaria.listing.application.command.ReservePropertyCommand;
import com.inmobiliaria.listing.application.command.ReservePropertyHandler;
import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.port.ProcessedEventStore;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

/**
 * Política "una oportunidad ganada reserva la propiedad" (ADR 0005, 3.1).
 * LeadClosed con outcome WON → ReservePropertyCommand con actor SYSTEM.
 *
 * <p>Todo en una transacción: processed_events + properties + outbox + catálogo. Si la regla de estado no
 * permite reservar, deja un WARN y confirma igual el processed_events: es una regla de negocio, no un error
 * técnico, y no va a la DLQ.
 */
public class ReserveOnLeadWonPolicy {

    private static final Logger log = LoggerFactory.getLogger(ReserveOnLeadWonPolicy.class);
    static final String EVENT_TYPE = "LeadClosed";

    private final ProcessedEventStore processedEvents;
    private final PropertyRepository properties;
    private final ReservePropertyHandler reserve;

    public ReserveOnLeadWonPolicy(ProcessedEventStore processedEvents, PropertyRepository properties,
            ReservePropertyHandler reserve) {
        this.processedEvents = processedEvents;
        this.properties = properties;
        this.reserve = reserve;
    }

    @Transactional
    public void handle(LeadClosed event) {
        if (!processedEvents.markProcessed(event.eventId(), EVENT_TYPE)) {
            log.debug("LeadClosed {} ya procesado: se descarta el duplicado", event.eventId());
            return;
        }
        if (event.outcome() != LeadClosed.Outcome.WON) {
            return;
        }
        PropertyId propertyId = new PropertyId(event.propertyId());
        Optional<Property> property = properties.findById(propertyId);
        if (property.isEmpty()) {
            log.warn("LeadClosed {}: la propiedad {} no existe; no se reserva", event.eventId(), propertyId);
            return;
        }
        if (property.get().status() != PropertyStatus.PUBLISHED) {
            log.warn("LeadClosed {}: la propiedad {} está {}; solo se reserva si está PUBLISHED",
                    event.eventId(), propertyId, property.get().status());
            return;
        }
        if (!property.get().isOwnedBy(event.agentId())) {
            log.warn("LeadClosed {}: el agente del evento no es el de la propiedad {}; no se reserva",
                    event.eventId(), propertyId);
            return;
        }
        // Las reglas de estado del aggregate se aplican igual: SYSTEM solo se salta el permiso del agente.
        reserve.handle(new ReservePropertyCommand(propertyId,
                CommandMetadata.system(event.correlationId(), event.eventId())));
        log.info("LeadClosed {}: propiedad {} reservada", event.eventId(), propertyId);
    }
}
