package com.inmobiliaria.listing.application.port;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import java.util.List;

/**
 * Puerto de salida para los eventos de dominio. La implementación (infrastructure/messaging) los
 * traduce a eventos de integración con el estado actual del aggregate y los guarda en el outbox, en la
 * misma transacción.
 */
public interface EventPublisher {

    void publish(Property property, List<? extends PropertyEvent> domainEvents, CommandMetadata metadata);
}
