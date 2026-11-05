package com.inmobiliaria.listing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.domain.exception.DomainException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void should_normalize_amount_to_two_decimals() {
        Money money = Money.bob(new BigDecimal("125000"));

        assertThat(money.amount()).isEqualByComparingTo("125000.00");
        assertThat(money.amount().scale()).isEqualTo(2);
        assertThat(money.currency()).isEqualTo("BOB");
    }

    @Test
    void should_compare_by_value() {
        assertThat(Money.bob(new BigDecimal("10.5"))).isEqualTo(Money.bob(new BigDecimal("10.50")));
    }

    @Test
    void should_reject_zero_or_negative_amount() {
        assertThatThrownBy(() -> Money.bob(BigDecimal.ZERO))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).code())
                .isEqualTo("PROPERTY_INVALID_PRICE");
        assertThatThrownBy(() -> Money.bob(new BigDecimal("-1"))).isInstanceOf(DomainException.class);
    }

    @Test
    void should_reject_more_than_two_decimals() {
        assertThatThrownBy(() -> Money.bob(new BigDecimal("10.555"))).isInstanceOf(DomainException.class);
    }

    @Test
    void should_reject_currency_other_than_bob() {
        assertThatThrownBy(() -> new Money(BigDecimal.TEN, "USD"))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).code())
                .isEqualTo("PROPERTY_INVALID_CURRENCY");
    }
}
