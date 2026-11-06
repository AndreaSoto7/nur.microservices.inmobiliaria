package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.exception.DomainException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;

class FavoriteTest {

    private static final Instant NOW = Instant.parse("2026-10-16T14:30:00Z");

    @Test
    void should_save_a_published_property() {
        UUID user = UUID.randomUUID();
        PropertyId property = PropertyId.newId();

        Favorite favorite = Favorite.add(user, property, PropertyStatus.PUBLISHED, NOW);

        assertThat(favorite.userId()).isEqualTo(user);
        assertThat(favorite.propertyId()).isEqualTo(property);
    }

    @ParameterizedTest
    @EnumSource(value = PropertyStatus.class, names = "PUBLISHED", mode = EnumSource.Mode.EXCLUDE)
    void should_reject_a_property_that_is_not_published(PropertyStatus status) {
        assertThatThrownBy(() -> Favorite.add(UUID.randomUUID(), PropertyId.newId(), status, NOW))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("FAVORITE_PROPERTY_NOT_PUBLISHED");
    }
}
