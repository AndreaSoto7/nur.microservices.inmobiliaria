package com.inmobiliaria.listing.presentation.rest.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record MoneyDto(
        @NotNull @DecimalMin(value = "0.01", message = "debe ser mayor a 0")
        @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @NotNull @Pattern(regexp = "BOB", message = "la única moneda aceptada es BOB") String currency) {
}
