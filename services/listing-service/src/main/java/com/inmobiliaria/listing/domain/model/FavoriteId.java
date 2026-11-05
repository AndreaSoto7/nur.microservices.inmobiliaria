package com.inmobiliaria.listing.domain.model;

import java.util.Objects;
import java.util.UUID;

public record FavoriteId(UUID value) {

    public FavoriteId {
        Objects.requireNonNull(value);
    }

    public static FavoriteId newId() {
        return new FavoriteId(UUID.randomUUID());
    }
}
