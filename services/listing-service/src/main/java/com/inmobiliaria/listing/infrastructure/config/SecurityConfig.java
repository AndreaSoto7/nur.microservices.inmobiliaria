package com.inmobiliaria.listing.infrastructure.config;

import java.util.Collection;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtTypeValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Resource server: valida el access token de identity con su JWKS (rule seguridad). La autorización
 * de dominio (¿es el agente dueño?) va en la capa de aplicación, no aquí.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    static final String ACCESS_TOKEN_TYPE = "at+jwt";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ProblemJsonSecurityHandler problemHandler)
            throws Exception {
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health", "/health/ready", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/**", "/api/v1/properties/*/images/*")
                        .permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(problemHandler)
                        .accessDeniedHandler(problemHandler))
                .exceptionHandling(e -> e.authenticationEntryPoint(problemHandler).accessDeniedHandler(problemHandler));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${listing.security.jwks-uri}") String jwksUri,
            @Value("${listing.security.issuer}") String issuer,
            @Value("${listing.security.audience}") String audience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                // El typ lo revisa JwtTypeValidator: Nimbus por defecto solo acepta "JWT".
                .validateType(false)
                .build();
        decoder.setJwtValidator(accessTokenValidator(issuer, audience));
        return decoder;
    }

    /** exp/nbf, iss, aud y typ=at+jwt: con esto un refresh token (typ=rt+jwt) nunca pasa. */
    static OAuth2TokenValidator<Jwt> accessTokenValidator(String issuer, String audience) {
        return new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                new JwtIssuerValidator(issuer),
                new JwtClaimValidator<Collection<?>>(JwtClaimNames.AUD, aud -> aud != null && aud.contains(audience)),
                new JwtTypeValidator(List.of(ACCESS_TOKEN_TYPE)));
    }

    /** Los roles vienen en el claim {@code roles} (CLIENT, AGENT, ADMIN) y quedan como ROLE_*. */
    static JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }
}
