package com.inmobiliaria.listing.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

/**
 * Tests de contrato (rule testing): valida un envelope del outbox contra
 * contracts/events/envelope.schema.json y su payload contra contracts/events/listing/<evento>.v1.
 * Lee los schemas del repo, así que un cambio del contrato que la implementación no siga rompe el test.
 */
public final class EventContracts {

    private static final Path EVENTS = Path.of("..", "..", "contracts", "events");
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final JsonSchemaFactory FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
    private static final SchemaValidatorsConfig CONFIG = SchemaValidatorsConfig.builder()
            .formatAssertionsEnabled(true)
            .build();

    private EventContracts() {}

    /** Devuelve los errores encontrados; vacío si el evento cumple el contrato. */
    public static Set<String> violations(String envelopeJson) {
        JsonNode envelope = read(envelopeJson);
        Set<String> errors = new HashSet<>(validate(schema(EVENTS.resolve("envelope.schema.json")), envelope));
        String type = envelope.path("eventType").asText();
        Path payloadSchema = EVENTS.resolve("listing").resolve(kebab(type) + ".v1.schema.json");
        if (!Files.exists(payloadSchema)) {
            errors.add("No hay schema para " + type + " en " + payloadSchema);
            return errors;
        }
        errors.addAll(validate(schema(payloadSchema), envelope.path("payload")));
        return errors;
    }

    private static Set<String> validate(JsonSchema schema, JsonNode node) {
        Set<String> result = new HashSet<>();
        for (ValidationMessage message : schema.validate(node)) {
            result.add(message.getMessage());
        }
        return result;
    }

    private static JsonSchema schema(Path path) {
        try (InputStream in = Files.newInputStream(path)) {
            return FACTORY.getSchema(in, CONFIG);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static JsonNode read(String json) {
        try {
            return JSON.readTree(json);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String kebab(String eventType) {
        return eventType.replaceAll("([a-z])([A-Z])", "$1-$2").toLowerCase();
    }
}
