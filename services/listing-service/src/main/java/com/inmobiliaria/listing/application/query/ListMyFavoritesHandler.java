package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageResult;
import org.springframework.transaction.annotation.Transactional;

/** Favoritos del usuario con el estado actual de cada propiedad. */
public class ListMyFavoritesHandler {

    private final PropertyReadModel readModel;

    public ListMyFavoritesHandler(PropertyReadModel readModel) {
        this.readModel = readModel;
    }

    @Transactional(readOnly = true)
    public PageResult<FavoriteView> handle(ListMyFavoritesQuery query) {
        return readModel.listFavorites(query.userId(), query.page());
    }
}
