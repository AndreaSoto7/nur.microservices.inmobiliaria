package com.inmobiliaria.listing.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger UI en /docs. La fuente de verdad es contracts/openapi/listing-service.yaml. */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI listingOpenApi() {
        return new OpenAPI()
                .info(new Info().title("listing-service").version("1.0.0")
                        .description("Contrato: contracts/openapi/listing-service.yaml"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
