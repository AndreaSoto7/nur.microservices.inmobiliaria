package com.inmobiliaria.listing.application.port;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import java.util.List;

/**
 * Puerto de salida para los eventos de dominio. La implementación (infrastructure/messaging) los
 * traduce a eventos de integración y los guarda en el outbox, en la misma transacción.
 */
public interface EventPublisher {

    void publish(List<? extends PropertyEvent> domainEvents);
}
