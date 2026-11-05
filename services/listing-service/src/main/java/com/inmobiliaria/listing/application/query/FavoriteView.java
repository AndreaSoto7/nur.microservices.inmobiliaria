package com.inmobiliaria.listing.application.query;

import java.time.Instant;

/** Un favorito con el estado actual de la propiedad. */
public record FavoriteView(PropertySummaryView property, Instant savedAt) {
}
