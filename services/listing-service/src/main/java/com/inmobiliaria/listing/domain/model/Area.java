package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.math.BigDecimal;
import java.util.Objects;

/** Superficie en m², mayor a 0 y con hasta 2 decimales. */
public record Area(BigDecimal squareMeters) {

    public Area {
        Objects.requireNonNull(squareMeters, "squareMeters");
        if (squareMeters.signum() <= 0) {
            throw new InvalidValueException("PROPERTY_INVALID_AREA", "La superficie debe ser mayor a 0");
        }
        if (squareMeters.stripTrailingZeros().scale() > 2) {
            throw new InvalidValueException("PROPERTY_INVALID_AREA", "La superficie admite como máximo 2 decimales");
        }
    }
}
