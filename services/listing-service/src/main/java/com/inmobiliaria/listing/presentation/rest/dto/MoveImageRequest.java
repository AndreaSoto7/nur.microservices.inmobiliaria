package com.inmobiliaria.listing.presentation.rest.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** La posición nueva de una foto en la galería: 0 es la portada. */
public record MoveImageRequest(@NotNull @Min(0) @Max(4) Integer position) {
}
