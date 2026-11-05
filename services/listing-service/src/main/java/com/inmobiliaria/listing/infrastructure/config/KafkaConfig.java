package com.inmobiliaria.listing.infrastructure.config;

import com.inmobiliaria.listing.infrastructure.messaging.LeadEventTranslator.MalformedEventException;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * Errores del consumidor (rule eventos-kafka): 3 intentos con backoff y, si sigue fallando, el mensaje va a
 * {@code <topic>.dlq} y el consumidor continúa. Un mensaje ilegible va directo a la DLQ.
 */
@Configuration
public class KafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConfig.class);

    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template) {
        // Partición -1: la elige Kafka (los topics .dlq tienen una sola partición).
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, exception) -> new TopicPartition(record.topic() + ".dlq", -1));
        ExponentialBackOff backOff = new ExponentialBackOff(1_000L, 2.0);
        backOff.setMaxAttempts(2); // 1 intento + 2 reintentos = 3 intentos
        DefaultErrorHandler handler = new DefaultErrorHandler((record, exception) -> {
            log.error("Evento enviado a la DLQ tras agotar los reintentos (topic={}, offset={}): {}",
                    record.topic(), record.offset(), exception.getMessage());
            recoverer.accept(record, exception);
        }, backOff);
        handler.addNotRetryableExceptions(MalformedEventException.class);
        return handler;
    }
}
