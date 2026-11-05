package com.inmobiliaria.listing.domain.model;

import java.util.Objects;
import java.util.UUID;

/** Identidad de una propiedad. La genera el dominio, nunca la base. */
public record PropertyId(UUID value) {

    public PropertyId {
        Objects.requireNonNull(value, "value");
    }

    public static PropertyId newId() {
        return new PropertyId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
