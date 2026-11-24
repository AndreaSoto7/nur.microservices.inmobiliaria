package com.inmobiliaria.listing.infrastructure.messaging;

import com.inmobiliaria.listing.application.policy.TrackScheduledVisitsPolicy;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consume visit.visit.events (consumer group listing-service, desde el principio) para llevar la copia
 * local de visitas confirmadas. Los reintentos y la DLQ están en KafkaConfig.
 */
@Component
@ConditionalOnProperty(name = "listing.kafka.consumer.enabled", havingValue = "true", matchIfMissing = true)
public class VisitEventsConsumer {

    private final VisitEventTranslator translator;
    private final TrackScheduledVisitsPolicy policy;

    public VisitEventsConsumer(VisitEventTranslator translator, TrackScheduledVisitsPolicy policy) {
        this.translator = translator;
        this.policy = policy;
    }

    @KafkaListener(topics = "visit.visit.events", groupId = "listing-service")
    public void onMessage(ConsumerRecord<String, String> record) {
        translator.translate(record.value()).ifPresent(change -> {
            MDC.put("correlationId", change.correlationId());
            try {
                policy.handle(change);
            } finally {
                MDC.remove("correlationId");
            }
        });
    }
}
