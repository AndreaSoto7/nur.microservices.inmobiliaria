package com.inmobiliaria.listing.infrastructure;

import static com.inmobiliaria.listing.support.InMemoryAdapters.gif;
import static com.inmobiliaria.listing.support.InMemoryAdapters.jpeg;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inmobiliaria.listing.domain.exception.ConcurrentPropertyModificationException;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import com.inmobiliaria.listing.support.EventContracts;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Integración de punta a punta del lado del agente: HTTP → handlers → JPA sobre un PostgreSQL 17 real
 * (Testcontainers, con las migraciones de Flyway) → outbox. Cada evento del outbox se valida contra
 * contracts/events. No necesita Kafka ni Consul.
 */
@SpringBootTest(properties = "spring.cloud.consul.enabled=false")
@AutoConfigureMockMvc
@Testcontainers
class PropertyApiIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    @TempDir
    static Path images;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("listing.images.dir", () -> images.toString());
    }

    private static final String AGENT = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PropertyRepository repository;

    @Test
    void agent_lifecycle_from_draft_to_sold_writes_contract_valid_events() throws Exception {
        String id = createProperty("SALE");
        Instant before = Instant.now();

        // Sin características ni imagen no se publica.
        mvc.perform(post("/api/v1/properties/{id}/publish", id).with(agent()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPERTY_INCOMPLETE"));
        mvc.perform(put("/api/v1/properties/{id}/features", id).with(agent())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bedrooms\":3,\"bathrooms\":2,\"areaM2\":240.5,\"features\":[\"GARDEN\",\"GARAGE\"]}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/properties/{id}/publish", id).with(agent()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPERTY_WITHOUT_IMAGES"));

        // El tipo se detecta del contenido: un GIF con nombre .jpg no pasa.
        mvc.perform(multipart("/api/v1/properties/{id}/images", id)
                        .file(new MockMultipartFile("file", "casa.jpg", "image/jpeg", gif())).with(agent()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROPERTY_IMAGE_INVALID_TYPE"));
        String imageUrl = mvc.perform(multipart("/api/v1/properties/{id}/images", id)
                        .file(new MockMultipartFile("file", "casa.jpg", "image/jpeg", jpeg())).with(agent()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");

        // En DRAFT la imagen solo la ve el dueño.
        mvc.perform(get(imageUrl)).andExpect(status().isNotFound());
        mvc.perform(get(imageUrl).with(agent())).andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(header().string("Cache-Control", "no-store, private"));

        mvc.perform(post("/api/v1/properties/{id}/publish", id).with(agent())).andExpect(status().isNoContent());
        mvc.perform(get(imageUrl))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes(jpeg()));

        mvc.perform(get("/api/v1/properties/{id}", id).with(agent()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.price.amount").value(1285000.00))
                .andExpect(jsonPath("$.features[0]").value("GARAGE"))
                .andExpect(jsonPath("$.images[0].url").value(imageUrl))
                .andExpect(jsonPath("$.publishedAt").isNotEmpty());

        // Edición visible, reservar, liberar, pausar, reanudar, reservar y vender.
        mvc.perform(put("/api/v1/properties/{id}", id).with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content(propertyJson(null).replace("Casa con jardín", "Casa con jardín y piscina")))
                .andExpect(status().isNoContent());
        for (String action : List.of("reserve", "release-reservation", "pause", "publish", "reserve")) {
            mvc.perform(post("/api/v1/properties/{id}/" + action, id).with(agent())).andExpect(status().isNoContent());
        }
        mvc.perform(post("/api/v1/properties/{id}/mark-rented", id).with(agent()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPERTY_OPERATION_MISMATCH"));
        mvc.perform(post("/api/v1/properties/{id}/mark-sold", id).with(agent())).andExpect(status().isNoContent());
        mvc.perform(put("/api/v1/properties/{id}", id).with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content(propertyJson(null)))
                .andExpect(status().isConflict());

        List<String> types = jdbc.queryForList(
                "select envelope->>'eventType' from outbox where aggregate_id = ? order by created_at, id",
                String.class, id);
        assertThat(types).containsExactlyInAnyOrder("PropertyPublished", "PropertyUpdated", "PropertyReserved",
                "PropertyPublished", "PropertyPaused", "PropertyPublished", "PropertyReserved", "PropertySold");
        for (String envelope : jdbc.queryForList("select envelope::text from outbox where aggregate_id = ?",
                String.class, id)) {
            assertThat(EventContracts.violations(envelope)).as(envelope).isEmpty();
        }
        assertThat(jdbc.queryForObject("select min(created_at) from outbox where aggregate_id = ?::text",
                java.sql.Timestamp.class, id).toInstant()).isAfterOrEqualTo(before.minusSeconds(5));
    }

    @Test
    void rented_property_writes_a_contract_valid_event() throws Exception {
        String id = createProperty("RENT");
        mvc.perform(put("/api/v1/properties/{id}/features", id).with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bedrooms\":1,\"bathrooms\":1,\"areaM2\":55,\"features\":[]}"))
                .andExpect(status().isNoContent());
        mvc.perform(multipart("/api/v1/properties/{id}/images", id)
                .file(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg())).with(agent()));
        mvc.perform(post("/api/v1/properties/{id}/publish", id).with(agent())).andExpect(status().isNoContent());
        // Una foto nueva en una propiedad visible cambia la galería que lleva el evento: PropertyUpdated.
        String secondImage = mvc.perform(multipart("/api/v1/properties/{id}/images", id)
                        .file(new MockMultipartFile("file", "b.jpg", "image/jpeg", jpeg())).with(agent()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        mvc.perform(get(secondImage))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=300, public"));
        mvc.perform(post("/api/v1/properties/{id}/mark-sold", id).with(agent()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPERTY_OPERATION_MISMATCH"));
        mvc.perform(post("/api/v1/properties/{id}/mark-rented", id).with(agent())).andExpect(status().isNoContent());

        List<String> types = jdbc.queryForList(
                "select envelope->>'eventType' from outbox where aggregate_id = ? order by created_at, id",
                String.class, id);
        assertThat(types).containsExactlyInAnyOrder("PropertyPublished", "PropertyUpdated", "PropertyRented");
        String updated = jdbc.queryForObject(
                "select envelope::text from outbox where aggregate_id = ? and envelope->>'eventType' = 'PropertyUpdated'",
                String.class, id);
        assertThat(updated).contains(secondImage);
        for (String envelope : jdbc.queryForList("select envelope::text from outbox where aggregate_id = ?",
                String.class, id)) {
            assertThat(EventContracts.violations(envelope)).as(envelope).isEmpty();
        }
    }

    @Test
    void only_the_owner_agent_sees_and_changes_a_property() throws Exception {
        String id = createProperty("SALE");
        JwtRequestPostProcessor otherAgent = jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_AGENT"));
        JwtRequestPostProcessor client = jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_CLIENT"));

        mvc.perform(get("/api/v1/properties/{id}", id).with(otherAgent))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PROPERTY_NOT_FOUND"));
        mvc.perform(post("/api/v1/properties/{id}/pause", id).with(otherAgent)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/properties/{id}", id).with(client))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        mvc.perform(get("/api/v1/properties/{id}", id))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void lists_my_properties_with_filters_and_page_metadata() throws Exception {
        String agent = UUID.randomUUID().toString();
        JwtRequestPostProcessor me = jwt().jwt(j -> j.subject(agent)).authorities(new SimpleGrantedAuthority("ROLE_AGENT"));
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/properties").with(me).contentType(MediaType.APPLICATION_JSON)
                    .content(propertyJson("SALE"))).andExpect(status().isCreated());
        }

        mvc.perform(get("/api/v1/properties").param("size", "2").param("status", "DRAFT").with(me))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].status").value("DRAFT"))
                .andExpect(jsonPath("$.data[0].coverImageUrl").isEmpty())
                .andExpect(jsonPath("$.page.number").value(1))
                .andExpect(jsonPath("$.page.totalElements").value(3))
                .andExpect(jsonPath("$.page.totalPages").value(2));
        mvc.perform(get("/api/v1/properties").param("size", "101").with(me)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/properties").param("sort", "title,asc").with(me))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void rejects_invalid_data_with_problem_json() throws Exception {
        mvc.perform(post("/api/v1/properties").with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content(propertyJson("SALE").replace("\"BOB\"", "\"USD\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROPERTY_INVALID_CURRENCY"));
        mvc.perform(post("/api/v1/properties").with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content(propertyJson("SALE").replace("\"title\":\"Casa con jardín\"", "\"title\":\"\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors[0].field").value("title"));
    }

    @Test
    void detects_a_concurrent_change_with_optimistic_locking() throws Exception {
        PropertyId id = new PropertyId(UUID.fromString(createProperty("SALE")));
        Property first = repository.findById(id).orElseThrow();
        Property second = repository.findById(id).orElseThrow();

        first.edit("Primer cambio", "", first.price(), first.location(), Instant.now());
        repository.save(first);
        second.edit("Segundo cambio", "", second.price(), second.location(), Instant.now());

        assertThatThrownBy(() -> repository.save(second)).isInstanceOf(ConcurrentPropertyModificationException.class);
    }

    private String createProperty(String operation) throws Exception {
        String location = mvc.perform(post("/api/v1/properties").with(agent()).contentType(MediaType.APPLICATION_JSON)
                        .content(propertyJson(operation)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn().getResponse().getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }

    /** Con operation null arma el body de edición (sin tipo ni operación). */
    private static String propertyJson(String operation) {
        String typeAndOperation = operation == null
                ? ""
                : "\"propertyType\":\"HOUSE\",\"operationType\":\"" + operation + "\",";
        return "{" + typeAndOperation
                + "\"title\":\"Casa con jardín\",\"description\":\"Dos plantas\","
                + "\"price\":{\"amount\":1285000.00,\"currency\":\"BOB\"},"
                + "\"location\":{\"zone\":\"Equipetrol\",\"address\":\"Calle 7 Oeste #120\","
                + "\"latitude\":-17.7633,\"longitude\":-63.1956}}";
    }

    private static JwtRequestPostProcessor agent() {
        return jwt().jwt(j -> j.subject(AGENT)).authorities(new SimpleGrantedAuthority("ROLE_AGENT"));
    }
}
