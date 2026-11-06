package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.domain.model.Amenity;
import java.util.Arrays;
import java.util.Locale;

/** Lee una característica de la API (GARAGE, garage) con un mensaje claro si no existe (400). */
final class Amenities {

    private Amenities() {
    }

    static Amenity parse(String value) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        try {
            return Amenity.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Característica desconocida '" + value + "'. Valores: "
                    + String.join(", ", Arrays.stream(Amenity.values()).map(Enum::name).toList()));
        }
    }
}
