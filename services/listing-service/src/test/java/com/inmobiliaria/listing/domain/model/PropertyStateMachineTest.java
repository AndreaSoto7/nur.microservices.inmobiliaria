package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * La tabla completa de services/listing-service/CLAUDE.md: estado × método. Lo que está en la tabla
 * llega al estado esperado; todo lo demás lanza InvalidStateTransitionException (→ 409).
 */
class PropertyStateMachineTest {

    private static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");

    private static final Map<String, BiConsumer<Property, Instant>> METHODS = Map.of(
            "publish", Property::publish,
            "pause", Property::pause,
            "reserve", (p, t) -> p.reserve(Actor.AGENT, t),
            "releaseReservation", Property::releaseReservation,
            "markSold", Property::markSold,
            "markRented", Property::markRented);

    /** Transiciones permitidas: (desde, método) → hacia. markSold/markRented según la operación. */
    private static final Map<String, PropertyStatus> ALLOWED = Map.ofEntries(
            Map.entry("DRAFT.publish", PropertyStatus.PUBLISHED),
            Map.entry("PAUSED.publish", PropertyStatus.PUBLISHED),
            Map.entry("PUBLISHED.pause", PropertyStatus.PAUSED),
            Map.entry("PUBLISHED.reserve", PropertyStatus.RESERVED),
            Map.entry("RESERVED.releaseReservation", PropertyStatus.PUBLISHED),
            Map.entry("PUBLISHED.markSold", PropertyStatus.SOLD),
            Map.entry("RESERVED.markSold", PropertyStatus.SOLD),
            Map.entry("PUBLISHED.markRented", PropertyStatus.RENTED),
            Map.entry("RESERVED.markRented", PropertyStatus.RENTED));

    static Stream<Arguments> everyStateAndMethod() {
        List<Arguments> cases = new ArrayList<>();
        for (PropertyStatus from : PropertyStatus.values()) {
            for (String method : METHODS.keySet()) {
                OperationType operation = operationFor(from, method);
                cases.add(Arguments.of(from, method, operation, ALLOWED.get(from + "." + method)));
            }
        }
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}.{1}() → {3}")
    @MethodSource("everyStateAndMethod")
    void should_follow_the_transition_table(PropertyStatus from, String method, OperationType operation,
            PropertyStatus expected) {
        Property property = inStatus(from, operation);
        BiConsumer<Property, Instant> action = METHODS.get(method);

        if (expected == null) {
            assertThatThrownBy(() -> action.accept(property, NOW.plusSeconds(10)))
                    .isInstanceOf(InvalidStateTransitionException.class);
            assertThat(property.status()).isEqualTo(from);
        } else {
            action.accept(property, NOW.plusSeconds(10));
            assertThat(property.status()).isEqualTo(expected);
        }
    }

    /** SOLD solo existe en SALE y RENTED en RENT; markSold se prueba en SALE y markRented en RENT. */
    private static OperationType operationFor(PropertyStatus from, String method) {
        if (from == PropertyStatus.SOLD) {
            return OperationType.SALE;
        }
        if (from == PropertyStatus.RENTED) {
            return OperationType.RENT;
        }
        return "markRented".equals(method) ? OperationType.RENT : OperationType.SALE;
    }

    private static Property inStatus(PropertyStatus status, OperationType operation) {
        Property property = Property.create(UUID.randomUUID(), "Departamento céntrico", "", PropertyType.APARTMENT,
                operation, Money.bob(new BigDecimal("950000")), Location.ofZone("Centro"), NOW);
        property.updateFeatures(2, 1, new Area(new BigDecimal("85")), Set.of(), NOW);
        UUID imageId = UUID.randomUUID();
        property.addImage(new PropertyImage(imageId, "image/png", 2048, "properties/" + imageId, NOW), NOW);
        switch (status) {
            case DRAFT -> { }
            case PUBLISHED -> property.publish(NOW);
            case PAUSED -> { property.publish(NOW); property.pause(NOW); }
            case RESERVED -> { property.publish(NOW); property.reserve(Actor.AGENT, NOW); }
            case SOLD -> { property.publish(NOW); property.markSold(NOW); }
            case RENTED -> { property.publish(NOW); property.markRented(NOW); }
        }
        return property;
    }
}
