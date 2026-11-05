package com.inmobiliaria.listing.presentation.rest.dto;

import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePropertyRequest(
        @NotBlank @Size(max = 150) String title,
        @Size(max = 5000) String description,
        @NotNull PropertyType propertyType,
        @NotNull OperationType operationType,
        @NotNull @Valid MoneyDto price,
        @NotNull @Valid LocationDto location) {
}
