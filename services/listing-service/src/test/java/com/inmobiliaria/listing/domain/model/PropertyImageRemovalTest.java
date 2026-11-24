package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import com.inmobiliaria.listing.support.PropertyMother;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PropertyImageRemovalTest {

    private static final Instant T1 = Instant.parse("2026-11-23T12:00:00Z");

    @Test
    void should_remove_the_cover_and_promote_the_next_image() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);
        PropertyImage cover = property.images().getFirst();
        PropertyImage second = PropertyMother.jpeg(property);
        property.addImage(second, T1);
        property.pullEvents();

        PropertyImage removed = property.removeImage(cover.id(), T1);

        assertThat(removed).isEqualTo(cover);
        assertThat(property.images()).containsExactly(second);
        assertThat(property.pullEvents()).singleElement().isInstanceOf(PropertyEvent.PropertyImageRemoved.class);
    }

    @Test
    void should_let_a_draft_end_up_without_images() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);

        property.removeImage(property.images().getFirst().id(), T1);

        assertThat(property.images()).isEmpty();
    }

    @Test
    void should_reject_removing_the_last_image_of_a_published_property() {
        Property property = PropertyMother.inStatus(PropertyStatus.PUBLISHED);
        UUID only = property.images().getFirst().id();

        assertThatThrownBy(() -> property.removeImage(only, T1))
                .isInstanceOf(DomainException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_LAST_IMAGE");
        assertThat(property.images()).hasSize(1);
    }

    @Test
    void should_reject_removing_images_of_a_sold_property() {
        Property property = PropertyMother.inStatus(PropertyStatus.SOLD);
        UUID only = property.images().getFirst().id();

        assertThatThrownBy(() -> property.removeImage(only, T1))
                .isInstanceOf(InvalidStateTransitionException.class);
    }

    @Test
    void should_reject_an_image_of_another_property() {
        Property property = PropertyMother.readyToPublish(OperationType.SALE);

        assertThatThrownBy(() -> property.removeImage(UUID.randomUUID(), T1))
                .isInstanceOf(DomainException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_NOT_FOUND");
    }
}
