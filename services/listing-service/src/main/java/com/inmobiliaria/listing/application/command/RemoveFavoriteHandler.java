package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.exception.FavoriteNotFoundException;
import com.inmobiliaria.listing.domain.repository.FavoriteRepository;
import org.springframework.transaction.annotation.Transactional;

/** Quita un favorito. Se puede quitar en cualquier estado de la propiedad. */
public class RemoveFavoriteHandler {

    private final FavoriteRepository favorites;

    public RemoveFavoriteHandler(FavoriteRepository favorites) {
        this.favorites = favorites;
    }

    @Transactional
    public void handle(RemoveFavoriteCommand command) {
        var favorite = favorites.find(command.userId(), command.propertyId())
                .orElseThrow(FavoriteNotFoundException::new);
        favorites.delete(favorite);
    }
}
