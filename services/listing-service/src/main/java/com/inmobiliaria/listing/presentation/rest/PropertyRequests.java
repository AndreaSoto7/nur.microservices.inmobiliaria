package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Bodies de contracts/openapi/listing-service.yaml. Aquí se valida el formato; las reglas de negocio
 * (precio > 0, BOB, coordenadas juntas, límites) las valida el dominio.
 */
final class PropertyRequests {

    private PropertyRequests() {}

    record MoneyRequest(@NotNull BigDecimal amount, @NotBlank String currency) {
        Money toDomain() {
            return new Money(amount, currency);
        }
    }

    record LocationRequest(@NotBlank @Size(max = 100) String zone, @Size(max = 255) String address,
            BigDecimal latitude, BigDecimal longitude) {
        Location toDomain() {
            return new Location(zone, address, latitude, longitude);
        }
    }

    record CreatePropertyRequest(
            @NotBlank @Size(max = 150) String title,
            @Size(max = 5000) String description,
            @NotNull PropertyType propertyType,
            @NotNull OperationType operationType,
            @NotNull @Valid MoneyRequest price,
            @NotNull @Valid LocationRequest location) {}

    record EditPropertyRequest(
            @NotBlank @Size(max = 150) String title,
            @Size(max = 5000) String description,
            @NotNull @Valid MoneyRequest price,
            @NotNull @Valid LocationRequest location) {}

    record FeaturesRequest(
            @NotNull @Min(0) @Max(100) Integer bedrooms,
            @NotNull @Min(0) @Max(100) Integer bathrooms,
            @NotNull BigDecimal areaM2,
            @NotNull @Size(max = 20) List<@NotNull Feature> features) {}

    record CreatedResponse(String id) {}
}
