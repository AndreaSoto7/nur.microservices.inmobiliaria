package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Los topes del dominio coinciden con las columnas de la base: un valor que la base rechazaría o
 * redondearía se rechaza antes, con un 400 claro, en vez de un 500 o un evento distinto de lo guardado.
 */
class DomainLimitsTest {

    private static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");

    @Test
    void should_reject_price_that_does_not_fit_the_column() {
        assertThatCode(() -> Money.bob(new BigDecimal("999999999999.99"))).doesNotThrowAnyException();
        assertThatThrownBy(() -> Money.bob(new BigDecimal("1000000000000")))
                .isInstanceOf(InvalidValueException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_PRICE");
    }

    @Test
    void should_reject_area_that_does_not_fit_the_column() {
        assertThatCode(() -> new Area(new BigDecimal("99999999.99"))).doesNotThrowAnyException();
        assertThatThrownBy(() -> new Area(new BigDecimal("100000000")))
                .isInstanceOf(InvalidValueException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_AREA");
    }

    @Test
    void should_reject_coordinates_with_more_than_six_decimals() {
        assertThatCode(() -> new Location("Centro", null, new BigDecimal("-17.763300"), new BigDecimal("-63.195600")))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> new Location("Centro", null, new BigDecimal("-17.7633001"), new BigDecimal("-63.1956")))
                .isInstanceOf(InvalidValueException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_LOCATION");
    }

    @Test
    void should_reject_more_than_one_hundred_rooms() {
        Property property = draft();

        assertThatThrownBy(() -> property.updateFeatures(Property.MAX_ROOMS + 1, 1, area(), Set.of(), NOW))
                .isInstanceOf(InvalidValueException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_FEATURES");
        assertThatThrownBy(() -> property.updateFeatures(1, Property.MAX_ROOMS + 1, area(), Set.of(), NOW))
                .isInstanceOf(InvalidValueException.class);
    }

    @Test
    void should_not_let_a_client_reserve() {
        Property property = draft();
        property.updateFeatures(2, 1, area(), Set.of(), NOW);
        UUID imageId = UUID.randomUUID();
        property.addImage(new PropertyImage(imageId, "image/png", 10, "k/" + imageId, NOW), NOW);
        property.publish(NOW);

        assertThatThrownBy(() -> property.reserve(Actor.CLIENT, NOW))
                .isInstanceOf(DomainException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_ACTOR");
    }

    private static Property draft() {
        return Property.create(UUID.randomUUID(), "Departamento", "", PropertyType.APARTMENT, OperationType.RENT,
                Money.bob(new BigDecimal("3500")), Location.ofZone("Centro"), NOW);
    }

    private static Area area() {
        return new Area(new BigDecimal("60"));
    }
}
