package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class PropertyTest {

    private static final Instant T0 = Instant.parse("2026-11-05T12:00:00Z");
    private static final Instant T1 = T0.plusSeconds(60);
    private static final Instant T2 = T0.plusSeconds(120);
    private static final UUID AGENT = UUID.fromString("8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");

    @Nested
    class Create {

        @Test
        void should_start_in_draft_and_record_created() {
            Property property = draft(OperationType.SALE);

            assertThat(property.status()).isEqualTo(PropertyStatus.DRAFT);
            assertThat(property.isOwnedBy(AGENT)).isTrue();
            assertThat(property.publishedAt()).isEmpty();
            assertThat(property.pullEvents()).singleElement().isInstanceOf(PropertyEvent.PropertyCreated.class);
        }

        @Test
        void should_reject_blank_title() {
            assertThatThrownBy(() -> Property.create(AGENT, "  ", "", PropertyType.HOUSE, OperationType.SALE,
                    price(), Location.ofZone("Equipetrol"), T0))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_TITLE");
        }

        @Test
        void should_reject_blank_zone() {
            assertThatThrownBy(() -> Location.ofZone(" "))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_LOCATION");
        }
    }

    @Nested
    class Publish {

        @Test
        void should_publish_complete_draft_with_image() {
            Property property = readyToPublish(OperationType.SALE);

            property.publish(T1);

            assertThat(property.status()).isEqualTo(PropertyStatus.PUBLISHED);
            assertThat(property.publishedAt()).contains(T1);
            assertThat(property.pullEvents()).last()
                    .isEqualTo(new PropertyEvent.PropertyPublished(property.id(), PropertyStatus.DRAFT, T1));
        }

        @Test
        void should_reject_publish_without_images() {
            Property property = draft(OperationType.SALE);
            property.updateFeatures(3, 2, area(), Set.of(), T0);

            assertThatThrownBy(() -> property.publish(T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_WITHOUT_IMAGES");
        }

        @Test
        void should_reject_publish_without_features() {
            Property property = draft(OperationType.SALE);
            property.addImage(image(), T0);

            assertThatThrownBy(() -> property.publish(T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_INCOMPLETE");
        }

        @Test
        void should_resume_paused_keeping_first_publication_date() {
            Property property = published(OperationType.SALE);
            property.pause(T1);
            property.pullEvents();

            property.publish(T2);

            assertThat(property.publishedAt()).contains(T0);
            assertThat(property.pullEvents()).singleElement()
                    .isEqualTo(new PropertyEvent.PropertyPublished(property.id(), PropertyStatus.PAUSED, T2));
        }

        @Test
        void should_reject_publish_when_already_published() {
            Property property = published(OperationType.SALE);

            assertThatThrownBy(() -> property.publish(T1)).isInstanceOf(InvalidStateTransitionException.class);
        }

        @Test
        void should_reject_publish_when_reserved() {
            Property property = published(OperationType.SALE);
            property.reserve(Actor.AGENT, T1);

            assertThatThrownBy(() -> property.publish(T2)).isInstanceOf(InvalidStateTransitionException.class);
        }
    }

    @Nested
    class Pause {

        @Test
        void should_pause_published() {
            Property property = published(OperationType.RENT);

            property.pause(T1);

            assertThat(property.status()).isEqualTo(PropertyStatus.PAUSED);
            assertThat(property.pullEvents()).last().isInstanceOf(PropertyEvent.PropertyPaused.class);
        }

        @Test
        void should_reject_pause_when_draft() {
            Property property = draft(OperationType.RENT);

            assertThatThrownBy(() -> property.pause(T1))
                    .isInstanceOf(InvalidStateTransitionException.class)
                    .hasMessageContaining("DRAFT")
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_TRANSITION");
        }
    }

    @Nested
    class Reserve {

        @Test
        void should_reserve_published_recording_actor() {
            Property property = published(OperationType.SALE);

            property.reserve(Actor.SYSTEM, T1);

            assertThat(property.status()).isEqualTo(PropertyStatus.RESERVED);
            assertThat(property.pullEvents()).last()
                    .isEqualTo(new PropertyEvent.PropertyReserved(property.id(), Actor.SYSTEM, T1));
        }

        @Test
        void should_reject_reserve_when_paused() {
            Property property = published(OperationType.SALE);
            property.pause(T1);

            assertThatThrownBy(() -> property.reserve(Actor.SYSTEM, T2))
                    .isInstanceOf(InvalidStateTransitionException.class);
        }

        @Test
        void should_release_reservation_back_to_published() {
            Property property = published(OperationType.SALE);
            property.reserve(Actor.AGENT, T1);
            property.pullEvents();

            property.releaseReservation(T2);

            assertThat(property.status()).isEqualTo(PropertyStatus.PUBLISHED);
            assertThat(property.pullEvents()).singleElement()
                    .isEqualTo(new PropertyEvent.PropertyPublished(property.id(), PropertyStatus.RESERVED, T2));
        }

        @Test
        void should_reject_release_when_not_reserved() {
            Property property = published(OperationType.SALE);

            assertThatThrownBy(() -> property.releaseReservation(T1))
                    .isInstanceOf(InvalidStateTransitionException.class);
        }
    }

    @Nested
    class Close {

        @Test
        void should_sell_published_sale() {
            Property property = published(OperationType.SALE);

            property.markSold(T1);

            assertThat(property.status()).isEqualTo(PropertyStatus.SOLD);
            assertThat(property.pullEvents()).last().isInstanceOf(PropertyEvent.PropertySold.class);
        }

        @Test
        void should_sell_reserved_sale() {
            Property property = published(OperationType.SALE);
            property.reserve(Actor.AGENT, T1);

            property.markSold(T2);

            assertThat(property.status()).isEqualTo(PropertyStatus.SOLD);
        }

        @Test
        void should_rent_published_rent() {
            Property property = published(OperationType.RENT);

            property.markRented(T1);

            assertThat(property.status()).isEqualTo(PropertyStatus.RENTED);
            assertThat(property.pullEvents()).last().isInstanceOf(PropertyEvent.PropertyRented.class);
        }

        @Test
        void should_reject_sell_on_rent_operation() {
            Property property = published(OperationType.RENT);

            assertThatThrownBy(() -> property.markSold(T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_OPERATION_MISMATCH");
        }

        @Test
        void should_reject_rent_on_sale_operation() {
            Property property = published(OperationType.SALE);

            assertThatThrownBy(() -> property.markRented(T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_OPERATION_MISMATCH");
        }

        @Test
        void should_reject_sell_when_draft() {
            Property property = draft(OperationType.SALE);

            assertThatThrownBy(() -> property.markSold(T1)).isInstanceOf(InvalidStateTransitionException.class);
        }

        @Test
        void should_reject_every_transition_after_sold() {
            Property property = published(OperationType.SALE);
            property.markSold(T1);

            assertThatThrownBy(() -> property.publish(T2)).isInstanceOf(InvalidStateTransitionException.class);
            assertThatThrownBy(() -> property.pause(T2)).isInstanceOf(InvalidStateTransitionException.class);
            assertThatThrownBy(() -> property.reserve(Actor.SYSTEM, T2))
                    .isInstanceOf(InvalidStateTransitionException.class);
            assertThatThrownBy(() -> property.markSold(T2)).isInstanceOf(InvalidStateTransitionException.class);
        }

        @Test
        void should_reject_edit_and_images_after_rented() {
            Property property = published(OperationType.RENT);
            property.markRented(T1);

            assertThatThrownBy(() -> property.edit("Otro", "", price(), Location.ofZone("Norte"), T2))
                    .isInstanceOf(InvalidStateTransitionException.class);
            assertThatThrownBy(() -> property.addImage(image(), T2))
                    .isInstanceOf(InvalidStateTransitionException.class);
        }
    }

    @Nested
    class Edit {

        @Test
        void should_not_announce_changes_of_a_draft() {
            Property property = draft(OperationType.SALE);
            property.pullEvents();

            property.edit("Casa renovada", "Con jardín", price(), Location.ofZone("Urubó"), T1);

            assertThat(property.title()).isEqualTo("Casa renovada");
            assertThat(property.pullEvents()).isEmpty();
        }

        @ParameterizedTest
        @EnumSource(value = PropertyStatus.class, names = {"PUBLISHED", "RESERVED"})
        void should_announce_changes_of_a_listed_property(PropertyStatus listed) {
            Property property = published(OperationType.SALE);
            if (listed == PropertyStatus.RESERVED) {
                property.reserve(Actor.AGENT, T1);
            }
            property.pullEvents();

            property.updateFeatures(4, 3, area(), Set.of(Feature.POOL), T2);

            assertThat(property.features()).containsExactly(Feature.POOL);
            assertThat(property.pullEvents()).singleElement()
                    .isEqualTo(new PropertyEvent.PropertyUpdated(property.id(), T2));
        }

        @Test
        void should_reject_negative_bedrooms() {
            Property property = draft(OperationType.SALE);

            assertThatThrownBy(() -> property.updateFeatures(-1, 1, area(), Set.of(), T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_INVALID_FEATURES");
        }

        @Test
        void should_reject_sixth_image() {
            Property property = draft(OperationType.SALE);
            for (int i = 0; i < Property.MAX_IMAGES; i++) {
                property.addImage(image(), T0);
            }

            assertThatThrownBy(() -> property.addImage(image(), T1))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_LIMIT");
        }

        @Test
        void should_reject_image_that_is_not_jpg_or_png() {
            assertThatThrownBy(() -> new PropertyImage(UUID.randomUUID(), "image/gif", 100, "k", T0))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_INVALID_TYPE");
        }

        @Test
        void should_reject_image_over_5_mb() {
            assertThatThrownBy(() -> new PropertyImage(
                    UUID.randomUUID(), "image/png", PropertyImage.MAX_SIZE_BYTES + 1, "k", T0))
                    .isInstanceOf(DomainException.class)
                    .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_TOO_LARGE");
        }
    }

    // ─── Test data builders ──────────────────────────────────────────────────

    private static Property draft(OperationType operation) {
        return Property.create(AGENT, "Casa con jardín", "Dos plantas", PropertyType.HOUSE, operation,
                price(), new Location("Equipetrol", "Calle 7 Oeste #120", null, null), T0);
    }

    private static Property readyToPublish(OperationType operation) {
        Property property = draft(operation);
        property.updateFeatures(3, 2, area(), Set.of(Feature.GARAGE, Feature.GARDEN), T0);
        property.addImage(image(), T0);
        return property;
    }

    private static Property published(OperationType operation) {
        Property property = readyToPublish(operation);
        property.publish(T0);
        property.pullEvents();
        return property;
    }

    private static Money price() {
        return Money.bob(new BigDecimal("1285000.00"));
    }

    private static Area area() {
        return new Area(new BigDecimal("240.5"));
    }

    private static PropertyImage image() {
        UUID id = UUID.randomUUID();
        return new PropertyImage(id, "image/jpeg", 1024, "properties/" + id, T0);
    }
}
