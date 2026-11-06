package com.inmobiliaria.listing.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import com.inmobiliaria.listing.application.command.RebuildCatalogHandler;
import com.inmobiliaria.listing.application.policy.LeadClosed;
import com.inmobiliaria.listing.application.policy.ReserveOnLeadWonPolicy;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integración de punta a punta contra PostgreSQL real (Testcontainers): migraciones Flyway, JPA con
 * ddl-auto=validate, proyección del catálogo, outbox y la política LeadClosed. Kafka y Consul apagados.
 */
@SpringBootTest(properties = {
        "spring.cloud.consul.enabled=false",
        "listing.outbox.relay.enabled=false",
        "listing.kafka.consumer.enabled=false",
        "listing.catalog.rebuild-on-startup=true",
        "spring.kafka.listener.auto-startup=false"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class ListingApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @TempDir
    static Path images;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("listing.images.dir", images::toString);
    }

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    RebuildCatalogHandler rebuildCatalog;

    @Autowired
    ReserveOnLeadWonPolicy policy;

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F'};

    private static RequestPostProcessor user(UUID id, String role) {
        return jwt().jwt(j -> j.subject(id.toString()).claim("roles", List.of(role)))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private UUID createPublishedProperty(UUID agent, String zone, String price, List<String> features)
            throws Exception {
        String body = json.writeValueAsString(Map.of(
                "title", "Casa en " + zone, "description", "Linda", "propertyType", "HOUSE",
                "operationType", "SALE", "price", Map.of("amount", price, "currency", "BOB"),
                "location", Map.of("zone", zone)));
        String created = mvc.perform(post("/api/v1/properties").with(user(agent, "AGENT"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(json.readTree(created).get("id").asString());

        mvc.perform(put("/api/v1/properties/{id}/features", id).with(user(agent, "AGENT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("bedrooms", 3, "bathrooms", 2, "areaM2", 240.5,
                                "features", features))))
                .andExpect(status().isNoContent());

        mvc.perform(multipart("/api/v1/properties/{id}/images", id)
                        .file(new MockMultipartFile("files", "foto.jpg", "image/jpeg", JPEG))
                        .with(user(agent, "AGENT")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageIds", hasSize(1)));

        mvc.perform(post("/api/v1/properties/{id}/publish", id).with(user(agent, "AGENT")))
                .andExpect(status().isNoContent());
        return id;
    }

    @Test
    void full_flow_from_draft_to_catalog_favorites_and_reservation_by_policy() throws Exception {
        UUID agent = UUID.randomUUID();
        UUID client = UUID.randomUUID();
        UUID id = createPublishedProperty(agent, "Equipetrol", "1285000.00", List.of("GARAGE", "POOL"));
        UUID other = createPublishedProperty(agent, "Urubó", "500000.00", List.of("GARDEN"));

        // Catálogo público con filtros combinados, sin token.
        mvc.perform(get("/api/v1/catalog/properties")
                        .param("zone", "EQUIPETROL").param("type", "HOUSE").param("operation", "SALE")
                        .param("minPrice", "1000000").param("features", "GARAGE,POOL").param("sort", "price,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].id").value(id.toString()))
                .andExpect(jsonPath("$.data[0].price.amount").value(1285000.00))
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.page.number").value(1));

        // Detalle público e imagen pública.
        String detail = mvc.perform(get("/api/v1/catalog/properties/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andReturn().getResponse().getContentAsString();
        String imageUrl = json.readTree(detail).at("/images/0/url").asString();
        mvc.perform(get(imageUrl)).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(content().bytes(JPEG));

        // Favoritos del cliente.
        mvc.perform(post("/api/v1/favorites").with(user(client, "CLIENT")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"propertyId\":\"" + id + "\"}")).andExpect(status().isCreated());
        mvc.perform(post("/api/v1/favorites").with(user(client, "CLIENT")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"propertyId\":\"" + id + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FAVORITE_ALREADY_EXISTS"));

        // Política: LeadClosed WON reserva la propiedad (y un duplicado no hace nada).
        LeadClosed won = new LeadClosed(UUID.randomUUID(), UUID.randomUUID(), id, agent,
                LeadClosed.Outcome.WON, "corr-lead");
        policy.handle(won);
        policy.handle(won);

        mvc.perform(get("/api/v1/favorites").with(user(client, "CLIENT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].property.status").value("RESERVED"));
        mvc.perform(get("/api/v1/catalog/properties/{id}", id))
                .andExpect(jsonPath("$.status").value("RESERVED"));

        // Outbox: 2 PropertyPublished + 1 PropertyReserved con causationId; nada de eventos internos.
        List<String> types = jdbc.queryForList("SELECT envelope->>'eventType' FROM outbox"
                + " WHERE aggregate_id IN (?, ?) ORDER BY created_at", String.class, id.toString(), other.toString());
        assertThat(types).containsExactly("PropertyPublished", "PropertyPublished", "PropertyReserved");
        JsonNode reserved = json.readTree(jdbc.queryForObject(
                "SELECT envelope::text FROM outbox WHERE envelope->>'eventType' = 'PropertyReserved'", String.class));
        assertThat(reserved.get("causationId").asString()).isEqualTo(won.eventId().toString());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM processed_events WHERE event_id = ?", Integer.class,
                won.eventId())).isEqualTo(1);

        // Vender la saca del catálogo.
        mvc.perform(post("/api/v1/properties/{id}/mark-sold", id).with(user(agent, "AGENT")))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/catalog/properties/{id}", id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/properties").with(user(agent, "AGENT")).param("status", "SOLD"))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].coverImageUrl").exists());
    }

    @Test
    void invalid_transition_is_409_problem_json() throws Exception {
        UUID agent = UUID.randomUUID();
        UUID id = createPublishedProperty(agent, "Centro", "100000", List.of());
        mvc.perform(post("/api/v1/properties/{id}/pause", id).with(user(agent, "AGENT")))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/v1/properties/{id}/mark-sold", id).with(user(agent, "AGENT"))
                        .header("X-Correlation-Id", "test-corr"))
                .andExpect(status().isConflict())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("PROPERTY_INVALID_TRANSITION"))
                .andExpect(jsonPath("$.correlationId").value("test-corr"))
                .andExpect(header().string("X-Correlation-Id", "test-corr"));

        // Paused: la imagen deja de ser pública.
        String detail = mvc.perform(get("/api/v1/properties/{id}", id).with(user(agent, "AGENT")))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get(json.readTree(detail).at("/images/0/url").asString())).andExpect(status().isNotFound());
    }

    @Test
    void other_agent_cannot_change_or_see_the_property() throws Exception {
        UUID id = createPublishedProperty(UUID.randomUUID(), "Norte", "200000", List.of());
        UUID stranger = UUID.randomUUID();

        mvc.perform(post("/api/v1/properties/{id}/pause", id).with(user(stranger, "AGENT")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PROPERTY_NOT_OWNER"));
        mvc.perform(get("/api/v1/properties/{id}", id).with(user(stranger, "AGENT")))
                .andExpect(status().isNotFound());
    }

    @Test
    void security_and_validation_errors_are_problem_json() throws Exception {
        mvc.perform(post("/api/v1/properties").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));

        mvc.perform(post("/api/v1/properties").with(user(UUID.randomUUID(), "CLIENT"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        mvc.perform(post("/api/v1/properties").with(user(UUID.randomUUID(), "AGENT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"propertyType\":\"HOUSE\",\"operationType\":\"SALE\","
                                + "\"price\":{\"amount\":0,\"currency\":\"BOB\"},\"location\":{\"zone\":\"A\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors[0].field").value("price.amount"));

        mvc.perform(get("/api/v1/catalog/properties").param("sort", "agentId,asc"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/catalog/properties").param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void health_endpoints_are_public() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/catalog/properties']").exists());
        mvc.perform(get("/health/ready")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void favorites_are_deleted_and_listed_per_user() throws Exception {
        UUID id = createPublishedProperty(UUID.randomUUID(), "Sur", "300000", List.of());
        UUID client = UUID.randomUUID();
        mvc.perform(post("/api/v1/favorites").with(user(client, "CLIENT")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"propertyId\":\"" + id + "\"}")).andExpect(status().isCreated());

        mvc.perform(get("/api/v1/favorites").with(user(UUID.randomUUID(), "CLIENT")))
                .andExpect(jsonPath("$.data", hasSize(0)));
        mvc.perform(delete("/api/v1/favorites/{id}", id).with(user(client, "CLIENT")))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/favorites/{id}", id).with(user(client, "CLIENT")))
                .andExpect(status().isNotFound());
    }

    @Test
    void rebuild_restores_a_catalog_row_that_got_lost() throws Exception {
        UUID id = createPublishedProperty(UUID.randomUUID(), "Zona Reconstruida", "420000", List.of());
        jdbc.update("DELETE FROM property_catalog WHERE property_id = ?", id);
        mvc.perform(get("/api/v1/catalog/properties").param("zone", "zona reconstruida"))
                .andExpect(jsonPath("$.data", hasSize(0)));

        rebuildCatalog.handle();

        mvc.perform(get("/api/v1/catalog/properties").param("zone", "zona reconstruida"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].id").value(id.toString()));
    }
}
