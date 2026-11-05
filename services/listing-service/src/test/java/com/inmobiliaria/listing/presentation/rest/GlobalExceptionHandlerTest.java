package com.inmobiliaria.listing.presentation.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new FakeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .addFilters(new CorrelationIdFilter())
                .build();
    }

    @Test
    void should_map_invalid_transition_to_409_problem_json() throws Exception {
        mvc.perform(get("/transition").header(CorrelationIdFilter.HEADER, "abc-123"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("PROPERTY_INVALID_TRANSITION"))
                .andExpect(jsonPath("$.type").value("https://inmobiliaria.local/problems/property-invalid-transition"))
                .andExpect(jsonPath("$.correlationId").value("abc-123"))
                .andExpect(header().string(CorrelationIdFilter.HEADER, "abc-123"));
    }

    @Test
    void should_map_invalid_domain_value_to_400() throws Exception {
        mvc.perform(get("/invalid-value"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROPERTY_INVALID_PRICE"));
    }

    @Test
    void should_map_validation_errors_to_400_with_fields() throws Exception {
        mvc.perform(post("/validate").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors[0].field").value("title"));
    }

    @Test
    void should_hide_unexpected_errors_behind_500() throws Exception {
        mvc.perform(get("/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.detail").value("Ocurrió un error inesperado"));
    }

    @Test
    void should_replace_malformed_correlation_id() throws Exception {
        mvc.perform(get("/transition").header(CorrelationIdFilter.HEADER, "\"><script>"))
                .andExpect(header().string(CorrelationIdFilter.HEADER,
                        org.hamcrest.Matchers.matchesPattern("[0-9a-f-]{36}")));
    }

    record Body(@NotBlank String title) {}

    @RestController
    static class FakeController {

        @GetMapping("/transition")
        void transition() {
            throw new InvalidStateTransitionException("No se puede pausar una propiedad en estado DRAFT");
        }

        @GetMapping("/invalid-value")
        void invalidValue() {
            throw new InvalidValueException("PROPERTY_INVALID_PRICE", "El precio debe ser mayor a 0");
        }

        @PostMapping("/validate")
        void validate(@Valid @RequestBody Body body) {}

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException("detalle interno que no debe salir");
        }
    }
}
