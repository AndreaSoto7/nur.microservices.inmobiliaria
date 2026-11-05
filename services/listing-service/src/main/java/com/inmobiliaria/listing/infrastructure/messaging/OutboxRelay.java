package com.inmobiliaria.listing.infrastructure.messaging;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Publica en Kafka las filas pendientes del outbox y marca solo las que Kafka confirmó. Entrega al menos
 * una vez. FOR UPDATE SKIP LOCKED permite varias réplicas (--scale) sin publicar lo mismo a la vez.
 */
@Component
@ConditionalOnProperty(name = "listing.outbox.relay.enabled", havingValue = "true", matchIfMissing = true)
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);
    private static final Duration SEND_TIMEOUT = Duration.ofSeconds(10);

    private final NamedParameterJdbcTemplate jdbc;
    private final KafkaTemplate<String, String> kafka;
    private final TransactionTemplate tx;
    private final int batchSize;

    public OutboxRelay(NamedParameterJdbcTemplate jdbc, KafkaTemplate<String, String> kafka, TransactionTemplate tx,
            @Value("${listing.outbox.relay.batch-size:100}") int batchSize) {
        this.jdbc = jdbc;
        this.kafka = kafka;
        this.tx = tx;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${listing.outbox.relay.interval-ms:1000}")
    public void publishPending() {
        try {
            Integer published;
            do {
                published = tx.execute(status -> publishBatch());
            } while (published != null && published == batchSize);
        } catch (RuntimeException e) {
            log.warn("No se pudo publicar el outbox; se reintenta en el próximo ciclo: {}", e.getMessage());
        }
    }

    int publishBatch() {
        List<OutboxMessage> pending = jdbc.query("""
                SELECT id, topic, aggregate_id, envelope::text AS envelope FROM outbox
                WHERE published_at IS NULL ORDER BY created_at LIMIT :limit FOR UPDATE SKIP LOCKED
                """, Map.of("limit", batchSize), (rs, n) -> new OutboxMessage(rs.getObject("id", UUID.class),
                rs.getString("topic"), rs.getString("aggregate_id"), rs.getString("envelope")));
        if (pending.isEmpty()) {
            return 0;
        }
        int delivered = 0;
        for (OutboxMessage message : pending) {
            // En orden y de a uno: si uno falla, los siguientes de la misma propiedad no se adelantan.
            CompletableFuture<SendResult<String, String>> send =
                    kafka.send(message.topic(), message.aggregateId(), message.envelope());
            try {
                send.get(SEND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            } catch (Exception e) {
                log.warn("Kafka no confirmó el evento {}: {}", message.id(), e.getMessage());
                break;
            }
            jdbc.update("UPDATE outbox SET published_at = now() WHERE id = :id", Map.of("id", message.id()));
            delivered++;
        }
        return delivered;
    }
}
