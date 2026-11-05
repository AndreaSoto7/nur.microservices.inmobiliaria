package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.Optional;
import java.util.Set;

/** Imagen pública. Responde 404 si la propiedad está en DRAFT o PAUSED (todavía o ya no es visible). */
public class GetPropertyImageHandler {

    private static final Set<String> HIDDEN = Set.of(PropertyStatus.DRAFT.name(), PropertyStatus.PAUSED.name());

    private final PropertyReadModel readModel;
    private final ImageStorage storage;

    public GetPropertyImageHandler(PropertyReadModel readModel, ImageStorage storage) {
        this.readModel = readModel;
        this.storage = storage;
    }

    public Optional<ImageContent> handle(GetPropertyImageQuery query) {
        return readModel.findImage(query.propertyId(), query.imageId())
                .filter(image -> !HIDDEN.contains(image.propertyStatus()))
                .flatMap(image -> storage.load(image.storageKey())
                        .map(bytes -> new ImageContent(image.contentType(), bytes)));
    }

    public ImageContent handleOrThrow(GetPropertyImageQuery query) {
        return handle(query).orElseThrow(() -> new PropertyNotFoundException(new PropertyId(query.propertyId())));
    }
}
