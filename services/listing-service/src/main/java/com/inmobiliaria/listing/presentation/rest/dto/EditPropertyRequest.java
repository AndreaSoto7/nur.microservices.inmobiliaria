package com.inmobiliaria.listing.presentation.rest.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Reemplazo completo de los datos editables (PUT). El tipo y la operación no cambian. */
public record EditPropertyRequest(
        @NotBlank @Size(max = 150) String title,
        @Size(max = 5000) String description,
        @NotNull @Valid MoneyDto price,
        @NotNull @Valid LocationDto location) {
}
