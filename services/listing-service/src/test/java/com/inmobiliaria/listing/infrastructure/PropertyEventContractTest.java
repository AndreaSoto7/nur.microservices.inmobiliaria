package com.inmobiliaria.listing.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.infrastructure.messaging.OutboxMessage;
import com.inmobiliaria.listing.infrastructure.messaging.PropertyIntegrationEventMapper;
import com.inmobiliaria.listing.support.PropertyMother;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.math.BigDecimal;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Test de contrato (rule testing): los eventos que produce listing cumplen el envelope y el JSON Schema de
 * su payload en contracts/events/.
 */
class PropertyEventContractTest {

    private static final Path CONTRACTS = Path.of("../../contracts/events");
    private static final Instant T1 = PropertyMother.T0.plusSeconds(60);

    // El validador de schemas trabaja con Jackson 2; el mapper de producción usa Jackson 3.
    private final ObjectMapper json = new ObjectMapper();
    private final PropertyIntegrationEventMapper mapper =
            new PropertyIntegrationEventMapper(JsonMapper.builder().build());
    private final CommandMetadata agent = CommandMetadata.agent(PropertyMother.AGENT, "corr-123");

    @Test
    void property_published_matches_contract() throws IOException {
        Property property = PropertyMother.inStatus(PropertyStatus.DRAFT, OperationType.SALE);
        property.edit("Casa", "Linda", Money.bob(new BigDecimal("1285000.5")),
                new Location("Equipetrol", "Calle 7", new BigDecimal("-17.7633"),
                        new BigDecimal("-63.1956")), PropertyMother.T0);
        property.pullEvents();
        property.publish(T1);

        JsonNode envelope = only(property, agent);

        assertValid(envelope, "envelope.schema.json");
        assertValid(envelope.get("payload"), "listing/property-published.v1.schema.json");
        assertThat(envelope.get("eventType").asText()).isEqualTo("PropertyPublished");
        assertThat(envelope.at("/payload/previousStatus").asText()).isEqualTo("DRAFT");
        assertThat(envelope.at("/payload/imageUrls/0").asText())
                .startsWith("/api/v1/properties/" + property.id() + "/images/");
        assertThat(envelope.at("/payload/price/amount").decimalValue()).isEqualByComparingTo("1285000.50");
        assertThat(envelope.get("aggregateId").asText()).isEqualTo(property.id().toString());
        assertThat(envelope.get("correlationId").asText()).isEqualTo("corr-123");
    }

    @Test
    void property_updated_matches_contract_and_is_only_emitted_when_listed() throws IOException {
        Property draft = PropertyMother.inStatus(PropertyStatus.DRAFT, OperationType.SALE);
        draft.edit("Otra", "", Money.bob(BigDecimal.TEN), Location.ofZone("Centro"), T1);
        assertThat(toOutbox(draft, agent)).isEmpty();

        Property reserved = PropertyMother.inStatus(PropertyStatus.RESERVED, OperationType.SALE);
        reserved.edit("Otra", "", Money.bob(BigDecimal.TEN), Location.ofZone("Centro"), T1);
        JsonNode envelope = only(reserved, agent);

        assertValid(envelope, "envelope.schema.json");
        assertValid(envelope.get("payload"), "listing/property-updated.v1.schema.json");
        assertThat(envelope.at("/payload/status").asText()).isEqualTo("RESERVED");
    }

    @Test
    void property_paused_matches_contract() throws IOException {
        Property property = PropertyMother.inStatus(PropertyStatus.PUBLISHED);
        property.pause(T1);

        JsonNode envelope = only(property, agent);

        assertValid(envelope.get("payload"), "listing/property-paused.v1.schema.json");
    }

    @Test
    void property_reserved_by_policy_matches_contract_with_causation() throws IOException {
        Property property = PropertyMother.inStatus(PropertyStatus.PUBLISHED);
        property.reserve(Actor.SYSTEM, T1);
        UUID leadClosedEventId = UUID.randomUUID();

        JsonNode envelope = only(property, CommandMetadata.system("corr-lead", leadClosedEventId));

        assertValid(envelope, "envelope.schema.json");
        assertValid(envelope.get("payload"), "listing/property-reserved.v1.schema.json");
        assertThat(envelope.get("causationId").asText()).isEqualTo(leadClosedEventId.toString());
        assertThat(envelope.at("/payload/actor").asText()).isEqualTo("SYSTEM");
    }

    @Test
    void property_sold_and_rented_match_contract() throws IOException {
        Property sold = PropertyMother.inStatus(PropertyStatus.RESERVED, OperationType.SALE);
        sold.markSold(T1);
        JsonNode soldPayload = only(sold, agent).get("payload");
        assertValid(soldPayload, "listing/property-sold.v1.schema.json");
        assertThat(soldPayload.get("operationType").asText()).isEqualTo("SALE");

        Property rented = PropertyMother.inStatus(PropertyStatus.PUBLISHED, OperationType.RENT);
        rented.markRented(T1);
        assertValid(only(rented, agent).get("payload"), "listing/property-rented.v1.schema.json");
    }

    @Test
    void releasing_a_reservation_publishes_again_with_previous_status() throws IOException {
        Property property = PropertyMother.inStatus(PropertyStatus.RESERVED);
        property.releaseReservation(T1);

        JsonNode envelope = only(property, agent);

        assertValid(envelope.get("payload"), "listing/property-published.v1.schema.json");
        assertThat(envelope.at("/payload/previousStatus").asText()).isEqualTo("RESERVED");
    }

    @Test
    void adding_images_to_a_draft_is_not_published() {
        Property property = PropertyMother.draft();
        property.addImage(PropertyMother.jpeg(property), T1);

        assertThat(toOutbox(property, agent)).isEmpty();
    }

    @Test
    void adding_images_to_a_listed_property_publishes_one_property_updated() throws IOException {
        Property property = PropertyMother.inStatus(PropertyStatus.PUBLISHED);
        property.addImage(PropertyMother.jpeg(property), T1);
        property.addImage(PropertyMother.jpeg(property), T1);

        JsonNode envelope = only(property, agent);

        assertValid(envelope, "envelope.schema.json");
        assertValid(envelope.get("payload"), "listing/property-updated.v1.schema.json");
        assertThat(envelope.get("eventType").asText()).isEqualTo("PropertyUpdated");
        assertThat(envelope.at("/payload/imageUrls")).hasSize(property.images().size());
    }

    @Test
    void editing_and_adding_images_in_one_batch_publishes_a_single_property_updated() {
        Property property = PropertyMother.inStatus(PropertyStatus.RESERVED);
        property.edit("Otra", "", Money.bob(BigDecimal.TEN), Location.ofZone("Centro"), T1);
        property.addImage(PropertyMother.jpeg(property), T1);

        assertThat(toOutbox(property, agent)).singleElement()
                .satisfies(m -> assertThat(m.envelope()).contains("\"eventType\":\"PropertyUpdated\""));
    }

    private List<OutboxMessage> toOutbox(Property property, CommandMetadata metadata) {
        List<PropertyEvent> events = property.pullEvents();
        return mapper.toOutbox(property, events, metadata);
    }

    private JsonNode only(Property property, CommandMetadata metadata) throws IOException {
        List<OutboxMessage> messages = toOutbox(property, metadata);
        assertThat(messages).hasSize(1);
        assertThat(messages.getFirst().topic()).isEqualTo("listing.property.events");
        return json.readTree(messages.getFirst().envelope());
    }

    private void assertValid(JsonNode node, String schemaFile) throws IOException {
        try (InputStream in = Files.newInputStream(CONTRACTS.resolve(schemaFile))) {
            JsonSchema schema = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012).getSchema(in);
            Set<ValidationMessage> errors = schema.validate(node);
            assertThat(errors).as(schemaFile).isEmpty();
        }
    }
}
