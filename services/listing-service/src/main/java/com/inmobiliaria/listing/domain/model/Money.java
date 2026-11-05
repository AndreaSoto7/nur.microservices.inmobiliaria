package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/** Precio en BOB, con dos decimales. Nunca float (convención del CLAUDE.md raíz). */
public record Money(BigDecimal amount, String currency) {

    public static final String BOB = "BOB";
    private static final int SCALE = 2;

    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (!BOB.equals(currency)) {
            throw new InvalidValueException("PROPERTY_INVALID_CURRENCY", "La única moneda aceptada es BOB");
        }
        if (amount.signum() <= 0) {
            throw new InvalidValueException("PROPERTY_INVALID_PRICE", "El precio debe ser mayor a 0");
        }
        if (amount.stripTrailingZeros().scale() > SCALE) {
            throw new InvalidValueException("PROPERTY_INVALID_PRICE", "El precio admite como máximo 2 decimales");
        }
        amount = amount.setScale(SCALE, RoundingMode.UNNECESSARY);
    }

    public static Money bob(BigDecimal amount) {
        return new Money(amount, BOB);
    }
}
