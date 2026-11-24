package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.Optional;
import java.util.Set;

/**
 * Imagen de la galería. Pública mientras la propiedad es visible; si está en DRAFT o PAUSED solo la ve el
 * agente dueño (para revisar sus fotos antes de publicar). A cualquier otro le responde 404.
 */
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
                .filter(image -> isPublic(image) || image.agentId().equals(query.viewerId()))
                .flatMap(image -> storage.load(image.storageKey())
                        .map(bytes -> new ImageContent(image.contentType(), bytes, isPublic(image))));
    }

    private static boolean isPublic(PropertyReadModel.ImageLocation image) {
        return !HIDDEN.contains(image.propertyStatus());
    }

    public ImageContent handleOrThrow(GetPropertyImageQuery query) {
        return handle(query).orElseThrow(() -> new PropertyNotFoundException(new PropertyId(query.propertyId())));
    }
}
