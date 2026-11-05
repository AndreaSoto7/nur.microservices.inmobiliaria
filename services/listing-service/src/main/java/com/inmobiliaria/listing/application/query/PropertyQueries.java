package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.UUID;

/** Consultas (CQRS): no cambian estado. */
public final class PropertyQueries {

    private PropertyQueries() {}

    /** Orden de "mis propiedades". El valor de la API es {@code campo,dirección} (rule api-rest). */
    public enum PropertySort {
        UPDATED_AT_DESC("updatedAt,desc"),
        UPDATED_AT_ASC("updatedAt,asc"),
        CREATED_AT_DESC("createdAt,desc"),
        CREATED_AT_ASC("createdAt,asc"),
        PRICE_ASC("price,asc"),
        PRICE_DESC("price,desc");

        private final String apiValue;

        PropertySort(String apiValue) {
            this.apiValue = apiValue;
        }

        public static PropertySort fromApi(String value) {
            for (PropertySort sort : values()) {
                if (sort.apiValue.equals(value)) return sort;
            }
            throw new InvalidValueException("VALIDATION_ERROR", "Orden no soportado: " + value);
        }
    }

    /** {@code status} es opcional (null = todos). {@code page} empieza en 1. */
    public record ListAgentPropertiesQuery(UUID agentId, PropertyStatus status, int page, int size,
            PropertySort sort) {}

    public record GetPropertyQuery(UUID propertyId, UUID agentId) {}

    /** {@code viewerId} es el sub del token si llegó uno; null si la imagen se pide sin sesión. */
    public record GetPropertyImageQuery(UUID propertyId, UUID imageId, UUID viewerId) {}

    /** {@code public} es false en DRAFT o PAUSED: solo la ve el dueño, así que no se cachea en proxies. */
    public record ImageContent(String contentType, byte[] content, boolean publiclyVisible) {}
}
