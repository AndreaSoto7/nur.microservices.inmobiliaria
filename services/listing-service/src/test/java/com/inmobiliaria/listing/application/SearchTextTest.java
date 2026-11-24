package com.inmobiliaria.listing.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.inmobiliaria.listing.application.common.SearchText;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SearchTextTest {

    @Test
    void should_drop_accents_case_and_extra_spaces() {
        assertThat(SearchText.normalize("  Urubó   Norte ")).isEqualTo("urubo norte");
        assertThat(SearchText.normalize("Ñuflo de Chávez")).isEqualTo("nuflo de chavez");
    }

    @ParameterizedTest
    @CsvSource({
        "Uru, uru",
        "URUBÓ, urubo",
        "zona norte, norte",
        "Zona   Las Palmas, las palmas",
        "zonaverde, zonaverde",
    })
    void should_turn_what_the_user_typed_into_the_zone_term(String typed, String term) {
        assertThat(SearchText.zoneTerm(typed)).isEqualTo(term);
    }

    @Test
    void should_ignore_a_search_with_nothing_but_the_word_zona() {
        assertThat(SearchText.zoneTerm(" Zona ")).isNull();
        assertThat(SearchText.zoneTerm("   ")).isNull();
        assertThat(SearchText.zoneTerm(null)).isNull();
    }
}
