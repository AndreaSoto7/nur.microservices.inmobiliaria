package com.inmobiliaria.listing.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.policy.VisitScheduleChange;
import com.inmobiliaria.listing.application.policy.VisitScheduleChange.Kind;
import com.inmobiliaria.listing.infrastructure.messaging.LeadEventTranslator.MalformedEventException;
import com.inmobiliaria.listing.infrastructure.messaging.VisitEventTranslator;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisitEventTranslatorTest {

    private final VisitEventTranslator translator = new VisitEventTranslator(JsonMapper.builder().build());

    private static String envelope(String type, int version, String payload) {
        return """
                {"eventId":"0b8f1c2e-1111-4c8e-9f10-5a6b7c8d9e01","eventType":"%s","eventVersion":%d,
                 "occurredAt":"2026-11-20T10:00:00Z","producer":"visit-service","aggregateType":"Visit",
                 "aggregateId":"9c8f1c2e-2222-4c8e-9f10-5a6b7c8d9e01","correlationId":"corr-7","payload":%s}
                """.formatted(type, version, payload);
    }

    private static final String SCHEDULED = """
            {"visitId":"9c8f1c2e-2222-4c8e-9f10-5a6b7c8d9e01","propertyId":"3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01",
             "clientId":"7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","agentId":"8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
             "scheduledStart":"2026-12-01T14:00:00Z","scheduledEnd":"2026-12-01T15:00:00Z"}
            """;

    private static final String CANCELLED = """
            {"visitId":"9c8f1c2e-2222-4c8e-9f10-5a6b7c8d9e01","propertyId":"3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01",
             "clientId":"7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","agentId":"8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
             "actor":"CLIENT","reason":null}
            """;

    @Test
    void should_translate_a_scheduled_visit_with_its_end() {
        VisitScheduleChange change = translator.translate(envelope("VisitScheduled", 1, SCHEDULED)).orElseThrow();

        assertThat(change.kind()).isEqualTo(Kind.SCHEDULED);
        assertThat(change.propertyId()).hasToString("3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01");
        assertThat(change.scheduledEnd()).isEqualTo(Instant.parse("2026-12-01T15:00:00Z"));
        assertThat(change.correlationId()).isEqualTo("corr-7");
    }

    @Test
    void should_treat_cancelled_and_completed_as_ended() {
        assertThat(translator.translate(envelope("VisitCancelled", 1, CANCELLED)).orElseThrow().kind())
                .isEqualTo(Kind.ENDED);
        assertThat(translator.translate(envelope("VisitCompleted", 1, CANCELLED)).orElseThrow().kind())
                .isEqualTo(Kind.ENDED);
    }

    @Test
    void should_ignore_other_types_and_versions() {
        assertThat(translator.translate(envelope("VisitRequested", 1, CANCELLED))).isEmpty();
        assertThat(translator.translate(envelope("VisitScheduled", 2, SCHEDULED))).isEmpty();
    }

    @Test
    void should_reject_a_scheduled_visit_without_end() {
        assertThatThrownBy(() -> translator.translate(envelope("VisitScheduled", 1, CANCELLED)))
                .isInstanceOf(MalformedEventException.class);
        assertThatThrownBy(() -> translator.translate("no es json")).isInstanceOf(MalformedEventException.class);
    }
}
