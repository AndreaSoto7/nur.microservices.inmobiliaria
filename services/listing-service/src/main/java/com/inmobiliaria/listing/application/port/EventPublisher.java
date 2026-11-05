package com.inmobiliaria.listing.application.port;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import java.util.List;

/**
 * Puerto de salida para los eventos de dominio. La implementación (infrastructure/messaging) los
 * traduce a eventos de integración y los guarda en el outbox, en la misma transacción que la
 * propiedad. Recibe la propiedad porque PropertyPublished y PropertyUpdated llevan su estado completo.
 */
public interface EventPublisher {

    void publish(Property source, List<? extends PropertyEvent> domainEvents);
}
