package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.policy.VisitScheduleChange;
import com.inmobiliaria.listing.application.policy.VisitScheduleChange.Kind;
import com.inmobiliaria.listing.infrastructure.messaging.LeadEventTranslator.MalformedEventException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Anti-corruption layer: traduce visit.visit.events a lo único que listing necesita, qué visitas están
 * confirmadas. Entiende VisitScheduled, VisitCancelled y VisitCompleted v1; el resto se ignora sin fallar.
 */
@Component
public class VisitEventTranslator {

    private static final Map<String, Kind> KINDS = Map.of(
            "VisitScheduled", Kind.SCHEDULED, "VisitCancelled", Kind.ENDED, "VisitCompleted", Kind.ENDED);

    private final JsonMapper json;

    public VisitEventTranslator(JsonMapper json) {
        this.json = json;
    }

    /**
     * @return el cambio, o vacío si el evento no le interesa a listing.
     * @throws MalformedEventException si el mensaje no se puede leer (va a la DLQ sin reintentos).
     */
    public Optional<VisitScheduleChange> translate(String message) {
        JsonNode envelope;
        try {
            envelope = json.readTree(message);
        } catch (JacksonException e) {
            throw new MalformedEventException("El mensaje no es JSON válido", e);
        }
        if (envelope == null || !envelope.isObject() || envelope.path("eventVersion").asInt(0) != 1) {
            return Optional.empty();
        }
        Kind kind = KINDS.get(envelope.path("eventType").asString(""));
        if (kind == null) {
            return Optional.empty();
        }
        try {
            JsonNode payload = envelope.required("payload");
            String correlationId = envelope.path("correlationId").asString("");
            Instant scheduledEnd = kind == Kind.SCHEDULED
                    ? Instant.parse(payload.required("scheduledEnd").asString())
                    : null;
            return Optional.of(new VisitScheduleChange(
                    UUID.fromString(envelope.required("eventId").asString()),
                    kind,
                    UUID.fromString(payload.required("visitId").asString()),
                    UUID.fromString(payload.required("propertyId").asString()),
                    scheduledEnd,
                    correlationId.isBlank() ? UUID.randomUUID().toString() : correlationId));
        } catch (IllegalArgumentException | DateTimeParseException | JacksonException e) {
            throw new MalformedEventException("Evento de visita con datos inválidos: " + e.getMessage(), e);
        }
    }
}
