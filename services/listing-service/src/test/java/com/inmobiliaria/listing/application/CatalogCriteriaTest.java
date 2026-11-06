package com.inmobiliaria.listing.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.query.CatalogCriteria;
import com.inmobiliaria.listing.domain.model.Amenity;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CatalogCriteriaTest {

    @Test
    void should_normalize_zone_and_keep_only_given_filters() {
        CatalogCriteria criteria = CatalogCriteria.builder().zone("  Equipetrol ")
                .withAmenities(Set.of(Amenity.POOL)).build();

        assertThat(criteria.zone()).contains("equipetrol");
        assertThat(criteria.propertyType()).isEmpty();
        assertThat(criteria.amenities()).containsExactly(Amenity.POOL);
    }

    @Test
    void should_reject_min_price_greater_than_max_price() {
        assertThatThrownBy(() -> CatalogCriteria.builder().priceBetween(BigDecimal.TEN, BigDecimal.ONE))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
