package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.exception.NotPropertyOwnerException;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.application.port.CatalogProjection;
import com.inmobiliaria.listing.application.port.Clock;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.time.Instant;

/**
 * Pasos comunes de los comandos sobre Property: cargar, autorizar y guardar. Guardar incluye, en la misma
 * transacción, la proyección del catálogo y los eventos del outbox.
 */
public class PropertyCommandSupport {

    private final PropertyRepository repository;
    private final CatalogProjection catalog;
    private final EventPublisher events;
    private final Clock clock;

    public PropertyCommandSupport(PropertyRepository repository, CatalogProjection catalog, EventPublisher events,
            Clock clock) {
        this.repository = repository;
        this.catalog = catalog;
        this.events = events;
        this.clock = clock;
    }

    /** Carga la propiedad y verifica que quien actúa sea su agente. SYSTEM se salta solo el permiso. */
    public Property loadForChange(PropertyId id, CommandMetadata metadata) {
        Property property = repository.findById(id).orElseThrow(() -> new PropertyNotFoundException(id));
        if (!metadata.isSystem() && !property.isOwnedBy(metadata.userId())) {
            throw new NotPropertyOwnerException();
        }
        return property;
    }

    public void commit(Property property, CommandMetadata metadata) {
        var pending = property.pullEvents();
        repository.save(property);
        catalog.sync(property);
        events.publish(property, pending, metadata);
    }

    public Instant now() {
        return clock.now();
    }
}
