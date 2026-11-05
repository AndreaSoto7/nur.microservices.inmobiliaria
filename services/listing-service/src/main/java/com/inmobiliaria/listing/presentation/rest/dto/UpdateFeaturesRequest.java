package com.inmobiliaria.listing.presentation.rest.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record UpdateFeaturesRequest(
        @NotNull @Min(0) @Max(100) Integer bedrooms,
        @NotNull @Min(0) @Max(100) Integer bathrooms,
        @NotNull @DecimalMin(value = "0.01", message = "debe ser mayor a 0") @Digits(integer = 8, fraction = 2)
        BigDecimal areaM2,
        @Size(max = 30) List<String> features) {
}
