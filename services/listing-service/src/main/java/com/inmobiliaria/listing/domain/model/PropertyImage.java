package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Imagen de la galería, parte del aggregate Property. El id también es el nombre del archivo: nunca
 * se usa el nombre original (rule seguridad). El MIME real lo detecta el adaptador antes de llegar aquí.
 */
public record PropertyImage(UUID id, String contentType, long sizeBytes, String storageKey, Instant uploadedAt) {

    public static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");

    public PropertyImage {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(storageKey, "storageKey");
        Objects.requireNonNull(uploadedAt, "uploadedAt");
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw new InvalidValueException("PROPERTY_IMAGE_INVALID_TYPE", "Solo se aceptan imágenes JPG o PNG");
        }
        if (sizeBytes < 1 || sizeBytes > MAX_SIZE_BYTES) {
            throw new InvalidValueException("PROPERTY_IMAGE_TOO_LARGE", "Cada imagen pesa como máximo 5 MB");
        }
    }
}
