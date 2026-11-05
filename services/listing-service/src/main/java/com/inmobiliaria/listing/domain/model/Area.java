package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.math.BigDecimal;
import java.util.Objects;

/** Superficie en m², mayor a 0 y con hasta 2 decimales. */
public record Area(BigDecimal squareMeters) {

    /** Lo que entra en numeric(10,2). */
    private static final BigDecimal MAX = new BigDecimal("99999999.99");

    public Area {
        Objects.requireNonNull(squareMeters, "squareMeters");
        if (squareMeters.signum() <= 0) {
            throw new InvalidValueException("PROPERTY_INVALID_AREA", "La superficie debe ser mayor a 0");
        }
        if (squareMeters.compareTo(MAX) > 0) {
            throw new InvalidValueException("PROPERTY_INVALID_AREA", "La superficie es demasiado grande");
        }
        if (squareMeters.stripTrailingZeros().scale() > 2) {
            throw new InvalidValueException("PROPERTY_INVALID_AREA", "La superficie admite como máximo 2 decimales");
        }
    }
}
