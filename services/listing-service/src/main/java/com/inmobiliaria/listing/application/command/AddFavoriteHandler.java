package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.application.port.Clock;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.model.Favorite;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.repository.FavoriteRepository;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import org.springframework.transaction.annotation.Transactional;

/** Guarda una propiedad PUBLISHED en los favoritos del usuario, sin repetir. */
public class AddFavoriteHandler {

    private final PropertyRepository properties;
    private final FavoriteRepository favorites;
    private final Clock clock;

    public AddFavoriteHandler(PropertyRepository properties, FavoriteRepository favorites, Clock clock) {
        this.properties = properties;
        this.favorites = favorites;
        this.clock = clock;
    }

    @Transactional
    public void handle(AddFavoriteCommand command) {
        Property property = properties.findById(command.propertyId())
                .orElseThrow(() -> new PropertyNotFoundException(command.propertyId()));
        if (favorites.exists(command.userId(), command.propertyId())) {
            throw new DomainException("FAVORITE_ALREADY_EXISTS", "La propiedad ya está en tus favoritos");
        }
        favorites.save(Favorite.add(command.userId(), property.id(), property.status(), clock.now()));
    }
}
