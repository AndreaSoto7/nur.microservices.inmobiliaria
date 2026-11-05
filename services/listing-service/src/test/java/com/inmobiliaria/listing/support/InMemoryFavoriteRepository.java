package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.domain.model.Favorite;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.FavoriteRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class InMemoryFavoriteRepository implements FavoriteRepository {

    public final List<Favorite> favorites = new ArrayList<>();

    @Override
    public Optional<Favorite> find(UUID userId, PropertyId propertyId) {
        return favorites.stream().filter(f -> f.userId().equals(userId) && f.propertyId().equals(propertyId))
                .findFirst();
    }

    @Override
    public boolean exists(UUID userId, PropertyId propertyId) {
        return find(userId, propertyId).isPresent();
    }

    @Override
    public void save(Favorite favorite) {
        favorites.add(favorite);
    }

    @Override
    public void delete(Favorite favorite) {
        favorites.remove(favorite);
    }
}
