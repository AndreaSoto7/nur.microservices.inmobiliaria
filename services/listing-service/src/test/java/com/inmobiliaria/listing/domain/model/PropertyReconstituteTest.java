package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.support.PropertyMother;
import org.junit.jupiter.api.Test;

/** Ida y vuelta: reconstruir una propiedad guardada no cambia su estado ni registra eventos. */
class PropertyReconstituteTest {

    @Test
    void should_rebuild_the_same_state_without_events() {
        Property original = PropertyMother.inStatus(PropertyStatus.RESERVED);

        Property copy = Property.reconstitute(original.id(), original.agentId(), original.title(),
                original.description(), original.type(), original.operation(), original.status(), original.price(),
                original.location(), original.bedrooms().orElse(null), original.bathrooms().orElse(null),
                original.area().orElse(null), original.amenities(), original.images(),
                original.publishedAt().orElse(null), original.createdAt(), original.updatedAt());

        assertThat(copy).usingRecursiveComparison().ignoringFields("pendingEvents").isEqualTo(original);
        assertThat(copy.pullEvents()).isEmpty();
    }

    @Test
    void should_keep_applying_rules_after_rebuilding() {
        Property original = PropertyMother.inStatus(PropertyStatus.PUBLISHED);
        Property copy = Property.reconstitute(original.id(), original.agentId(), original.title(),
                original.description(), original.type(), original.operation(), original.status(), original.price(),
                original.location(), original.bedrooms().orElse(null), original.bathrooms().orElse(null),
                original.area().orElse(null), original.amenities(), original.images(),
                original.publishedAt().orElse(null), original.createdAt(), original.updatedAt());

        copy.pause(PropertyMother.T0.plusSeconds(60));

        assertThat(copy.status()).isEqualTo(PropertyStatus.PAUSED);
        assertThat(copy.pullEvents()).singleElement().isInstanceOf(
                PropertyEvent.PropertyPaused.class);
    }
}
