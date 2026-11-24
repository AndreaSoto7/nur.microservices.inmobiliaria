package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.exception.PropertyImageNotFoundException;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Quitar una foto de la galería: solo el dueño; no si está vendida o alquilada; una propiedad visible no se
 * queda sin fotos. El archivo se borra recién cuando la transacción confirma, para no dejar una fila sin imagen.
 */
public class RemovePropertyImageHandler {

    private final PropertyCommandSupport support;
    private final ImageStorage storage;

    public RemovePropertyImageHandler(PropertyCommandSupport support, ImageStorage storage) {
        this.support = support;
        this.storage = storage;
    }

    @Transactional
    public void handle(RemovePropertyImageCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        boolean hasImage = property.images().stream().anyMatch(image -> image.id().equals(command.imageId()));
        if (!hasImage) {
            throw new PropertyImageNotFoundException(command.imageId());
        }
        PropertyImage removed = property.removeImage(command.imageId(), support.now());
        support.commit(property, command.metadata());
        deleteFileAfterCommit(removed.storageKey());
    }

    private void deleteFileAfterCommit(String storageKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            storage.delete(storageKey);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(storageKey);
            }
        });
    }
}
