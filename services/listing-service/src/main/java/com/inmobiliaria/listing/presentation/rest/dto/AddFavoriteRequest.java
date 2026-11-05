package com.inmobiliaria.listing.presentation.rest.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddFavoriteRequest(@NotNull UUID propertyId) {
}
