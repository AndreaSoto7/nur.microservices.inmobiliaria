package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.command.PropertyCommands.AddPropertyImageCommand;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** updateGalleryCommand: agrega una imagen al final de la galería. Devuelve solo su ID. */
@Service
public class AddPropertyImageHandler {

    private final PropertyRepository repository;
    private final ImageStorage storage;
    private final EventPublisher events;
    private final Clock clock;

    public AddPropertyImageHandler(PropertyRepository repository, ImageStorage storage, EventPublisher events,
            Clock clock) {
        this.repository = repository;
        this.storage = storage;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public UUID handle(AddPropertyImageCommand command) {
        Property property = OwnedProperties.load(repository, command.propertyId(), command.agentId());
        Instant now = clock.instant();
        UUID imageId = UUID.randomUUID();
        String key = "properties/" + property.id() + "/" + imageId;
        // Primero el aggregate: si rechaza la imagen (tipo, tamaño, límite, estado), no se escribe nada.
        property.addImage(new PropertyImage(imageId, ImageFormat.detect(command.content()),
                command.content().length, key, now), now);
        storage.store(key, command.content());
        deleteFileIfRolledBack(key);
        repository.save(property);
        events.publish(property, property.pullEvents());
        return imageId;
    }

    /** El archivo no es parte de la transacción: si la base hace rollback, se borra para no dejar huérfanos. */
    private void deleteFileIfRolledBack(String key) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
    }
}
