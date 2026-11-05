package com.inmobiliaria.listing.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

class AccessTokenValidatorTest {

    private final OAuth2TokenValidator<Jwt> validator =
            SecurityConfig.accessTokenValidator("identity-service", "inmobiliaria");

    @Test
    void should_accept_access_token_from_identity() {
        Jwt jwt = token("at+jwt", "identity-service", "inmobiliaria").build();

        assertThat(validator.validate(jwt).hasErrors()).isFalse();
    }

    @Test
    void should_reject_refresh_token_type_even_with_valid_issuer_and_audience() {
        Jwt jwt = token("rt+jwt", "identity-service", "inmobiliaria").build();

        assertThat(validator.validate(jwt).hasErrors()).isTrue();
    }

    @Test
    void should_reject_access_token_type_with_wrong_audience() {
        Jwt jwt = token("at+jwt", "identity-service", "otro-servicio").build();

        assertThat(validator.validate(jwt).hasErrors()).isTrue();
    }

    @Test
    void should_reject_wrong_issuer() {
        Jwt jwt = token("at+jwt", "otro-emisor", "inmobiliaria").build();

        assertThat(validator.validate(jwt).hasErrors()).isTrue();
    }

    @Test
    void should_reject_expired_token() {
        Instant past = Instant.now().minusSeconds(3600);
        Jwt jwt = token("at+jwt", "identity-service", "inmobiliaria")
                .issuedAt(past.minusSeconds(900))
                .expiresAt(past)
                .build();

        assertThat(validator.validate(jwt).hasErrors()).isTrue();
    }

    private static Jwt.Builder token(String typ, String issuer, String audience) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .header("typ", typ)
                .subject("8a6e0804-2bd0-4672-b79d-d97027f9071a")
                .issuer(issuer)
                .audience(List.of(audience))
                .claim("roles", List.of("AGENT"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(900));
    }
}
