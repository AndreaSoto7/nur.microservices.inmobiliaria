package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.policy.ReserveOnLeadWonPolicy;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consume visit.lead.events (consumer group listing-service, desde el principio) y dispara la política
 * ReserveOnLeadWonPolicy. Los reintentos y la DLQ están en KafkaConfig.
 */
@Component
@ConditionalOnProperty(name = "listing.kafka.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class LeadEventsConsumer {

    private final LeadEventTranslator translator;
    private final ReserveOnLeadWonPolicy policy;

    public LeadEventsConsumer(LeadEventTranslator translator, ReserveOnLeadWonPolicy policy) {
        this.translator = translator;
        this.policy = policy;
    }

    @KafkaListener(topics = "visit.lead.events", groupId = "listing-service")
    public void onMessage(ConsumerRecord<String, String> record) {
        translator.translate(record.value()).ifPresent(event -> {
            MDC.put("correlationId", event.correlationId());
            try {
                policy.handle(event);
            } finally {
                MDC.remove("correlationId");
            }
        });
    }
}
