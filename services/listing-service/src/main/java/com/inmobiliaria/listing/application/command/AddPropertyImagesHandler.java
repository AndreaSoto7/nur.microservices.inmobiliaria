package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

/**
 * updateGalleryCommand: solo el dueño; JPG o PNG reales; máximo 5; no si está vendida o alquilada.
 * Cada archivo se guarda con un UUID como nombre, nunca con el nombre original.
 */
public class AddPropertyImagesHandler {

    private final PropertyCommandSupport support;
    private final ImageStorage storage;

    public AddPropertyImagesHandler(PropertyCommandSupport support, ImageStorage storage) {
        this.support = support;
        this.storage = storage;
    }

    @Transactional
    public List<UUID> handle(AddPropertyImagesCommand command) {
        Property property = support.loadForChange(command.propertyId(), command.metadata());
        if (command.images().isEmpty()) {
            throw new InvalidValueException("PROPERTY_IMAGE_REQUIRED", "Envía al menos una imagen");
        }
        // El límite se revisa antes de escribir un solo archivo.
        if (property.images().size() + command.images().size() > Property.MAX_IMAGES) {
            throw new DomainException("PROPERTY_IMAGE_LIMIT", "Una propiedad tiene como máximo "
                    + Property.MAX_IMAGES + " imágenes; ya tiene " + property.images().size());
        }

        Instant now = support.now();
        List<PropertyImage> images = new ArrayList<>();
        for (byte[] content : command.images()) {
            String contentType = ImageTypeDetector.detect(content).orElseThrow(() -> new InvalidValueException(
                    "PROPERTY_IMAGE_INVALID_TYPE", "Solo se aceptan imágenes JPG o PNG"));
            UUID imageId = UUID.randomUUID();
            String key = property.id() + "/" + imageId + "." + ImageTypeDetector.extension(contentType);
            images.add(new PropertyImage(imageId, contentType, content.length, key, now));
        }
        for (PropertyImage image : images) {
            property.addImage(image, now);
        }

        List<String> stored = new ArrayList<>();
        try {
            for (int i = 0; i < images.size(); i++) {
                storage.store(images.get(i).storageKey(), command.images().get(i));
                stored.add(images.get(i).storageKey());
            }
            support.commit(property, command.metadata());
        } catch (RuntimeException e) {
            stored.forEach(storage::delete);
            throw e;
        }
        return images.stream().map(PropertyImage::id).toList();
    }
}
