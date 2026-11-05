package com.inmobiliaria.listing.application.exception;

/** El usuario no tiene esa propiedad en sus favoritos (→ 404). */
public class FavoriteNotFoundException extends ApplicationException {

    public FavoriteNotFoundException() {
        super("FAVORITE_NOT_FOUND", "La propiedad no está en tus favoritos");
    }
}
