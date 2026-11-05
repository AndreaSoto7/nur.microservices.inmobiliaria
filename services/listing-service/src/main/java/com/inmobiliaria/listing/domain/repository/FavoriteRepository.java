package com.inmobiliaria.listing.domain.repository;

import com.inmobiliaria.listing.domain.model.Favorite;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.Optional;
import java.util.UUID;

public interface FavoriteRepository {

    Optional<Favorite> find(UUID userId, PropertyId propertyId);

    boolean exists(UUID userId, PropertyId propertyId);

    void save(Favorite favorite);

    void delete(Favorite favorite);
}
