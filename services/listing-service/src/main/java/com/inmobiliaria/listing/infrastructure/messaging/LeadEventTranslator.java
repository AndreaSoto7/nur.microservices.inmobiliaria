package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.policy.LeadClosedNotification;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Anti-corruption layer: traduce los mensajes de visit.lead.events al modelo de listing. Solo entiende
 * LeadClosed v1; cualquier otro tipo o versión se ignora sin fallar (rule eventos-kafka).
 */
@Component
public class LeadEventTranslator {

    static final String LEAD_CLOSED = "LeadClosed";

    private final JsonMapper json;

    public LeadEventTranslator(JsonMapper json) {
        this.json = json;
    }

    /**
     * @return la notificación, o vacío si el evento no le interesa a listing.
     * @throws MalformedEventException si el mensaje no se puede leer (va a la DLQ sin reintentos).
     */
    public Optional<LeadClosedNotification> translate(String message) {
        JsonNode envelope;
        try {
            envelope = json.readTree(message);
        } catch (JacksonException e) {
            throw new MalformedEventException("El mensaje no es JSON válido", e);
        }
        if (envelope == null || !envelope.isObject()
                || !LEAD_CLOSED.equals(envelope.path("eventType").asString(""))
                || envelope.path("eventVersion").asInt(0) != 1) {
            return Optional.empty();
        }
        try {
            JsonNode payload = envelope.required("payload");
            String correlationId = envelope.path("correlationId").asString("");
            return Optional.of(new LeadClosedNotification(
                    UUID.fromString(envelope.required("eventId").asString()),
                    uuidOrNull(payload.path("leadId")),
                    UUID.fromString(payload.required("propertyId").asString()),
                    UUID.fromString(payload.required("agentId").asString()),
                    LeadClosedNotification.Outcome.valueOf(payload.required("outcome").asString()),
                    correlationId.isBlank() ? UUID.randomUUID().toString() : correlationId));
        } catch (IllegalArgumentException | JacksonException e) {
            throw new MalformedEventException("LeadClosed con datos inválidos: " + e.getMessage(), e);
        }
    }

    private static UUID uuidOrNull(JsonNode node) {
        return node.isMissingNode() || node.isNull() ? null : UUID.fromString(node.asString());
    }

    /** Un mensaje que nunca se va a poder procesar: no se reintenta. */
    public static class MalformedEventException extends RuntimeException {

        public MalformedEventException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
