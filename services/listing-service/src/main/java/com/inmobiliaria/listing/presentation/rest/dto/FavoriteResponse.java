package com.inmobiliaria.listing.presentation.rest.dto;

import com.inmobiliaria.listing.application.query.FavoriteView;
import java.time.Instant;

public record FavoriteResponse(PropertySummaryResponse property, Instant savedAt) {

    public static FavoriteResponse from(FavoriteView v) {
        return new FavoriteResponse(PropertySummaryResponse.from(v.property()), v.savedAt());
    }
}
