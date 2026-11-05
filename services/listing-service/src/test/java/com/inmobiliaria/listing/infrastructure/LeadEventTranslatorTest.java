package com.inmobiliaria.listing.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.policy.LeadClosedNotification;
import com.inmobiliaria.listing.infrastructure.messaging.LeadEventTranslator;
import com.inmobiliaria.listing.infrastructure.messaging.LeadEventTranslator.MalformedEventException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LeadEventTranslatorTest {

    private final LeadEventTranslator translator = new LeadEventTranslator(JsonMapper.builder().build());

    private static String envelope(String type, int version, String payload) {
        return """
                {"eventId":"0b8f1c2e-1111-4c8e-9f10-5a6b7c8d9e01","eventType":"%s","eventVersion":%d,
                 "occurredAt":"2026-10-20T10:00:00Z","producer":"visit-service","aggregateType":"Lead",
                 "aggregateId":"9c8f1c2e-2222-4c8e-9f10-5a6b7c8d9e01","correlationId":"corr-9","payload":%s}
                """.formatted(type, version, payload);
    }

    private static final String WON = """
            {"leadId":"9c8f1c2e-2222-4c8e-9f10-5a6b7c8d9e01","propertyId":"3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01",
             "agentId":"8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","clientId":"7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
             "outcome":"WON"}
            """;

    @Test
    void should_translate_lead_closed_v1() {
        LeadClosedNotification event = translator.translate(envelope("LeadClosed", 1, WON)).orElseThrow();

        assertThat(event.outcome()).isEqualTo(LeadClosedNotification.Outcome.WON);
        assertThat(event.propertyId()).hasToString("3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01");
        assertThat(event.correlationId()).isEqualTo("corr-9");
    }

    @Test
    void should_ignore_other_event_types_and_versions() {
        assertThat(translator.translate(envelope("LeadOpened", 1, "{}"))).isEmpty();
        assertThat(translator.translate(envelope("LeadClosed", 2, WON))).isEmpty();
    }

    @Test
    void should_reject_unreadable_messages() {
        assertThatThrownBy(() -> translator.translate("no-json")).isInstanceOf(MalformedEventException.class);
        assertThatThrownBy(() -> translator.translate(envelope("LeadClosed", 1, "{\"outcome\":\"WON\"}")))
                .isInstanceOf(MalformedEventException.class);
    }
}
