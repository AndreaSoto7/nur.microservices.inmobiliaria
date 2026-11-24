package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import com.inmobiliaria.listing.support.PropertyMother;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PropertyImageOrderTest {

    private static final Instant T1 = Instant.parse("2026-11-24T12:00:00Z");

    @Test
    void should_make_an_image_the_cover_and_shift_the_rest() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);
        PropertyImage first = property.images().getFirst();
        PropertyImage second = PropertyMother.jpeg(property);
        PropertyImage third = PropertyMother.jpeg(property);
        property.addImage(second, T1);
        property.addImage(third, T1);
        property.pullEvents();

        property.moveImage(third.id(), 0, T1);

        assertThat(property.images()).containsExactly(third, first, second);
        assertThat(property.pullEvents()).singleElement().isInstanceOf(PropertyEvent.PropertyImagesReordered.class);
    }

    @Test
    void should_do_nothing_when_the_image_is_already_there() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);
        property.pullEvents();

        property.moveImage(property.images().getFirst().id(), 0, T1);

        assertThat(property.pullEvents()).isEmpty();
    }

    @Test
    void should_reject_a_position_outside_the_gallery() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);

        assertThatThrownBy(() -> property.moveImage(property.images().getFirst().id(), 1, T1))
                .isInstanceOf(DomainException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_INVALID_POSITION");
    }

    @Test
    void should_reject_reordering_a_sold_property() {
        Property property = PropertyMother.inStatus(PropertyStatus.SOLD);

        assertThatThrownBy(() -> property.moveImage(property.images().getFirst().id(), 0, T1))
                .isInstanceOf(InvalidStateTransitionException.class);
    }
}
