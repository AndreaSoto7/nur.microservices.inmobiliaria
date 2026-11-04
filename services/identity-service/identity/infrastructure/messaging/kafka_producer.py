import json
import logging
from uuid import UUID

from confluent_kafka import KafkaError, KafkaException, Producer

from identity.infrastructure.persistence.models import OutboxMessage

logger = logging.getLogger(__name__)

DELIVERY_TIMEOUT_MS = 10_000
FLUSH_TIMEOUT_SECONDS = 15


class KafkaEventProducer:
    """Adapter de EventProducer. acks=all e idempotencia: no pierde ni duplica al reintentar."""

    def __init__(self, bootstrap_servers: str) -> None:
        self._producer = Producer(
            {
                "bootstrap.servers": bootstrap_servers,
                "acks": "all",
                "enable.idempotence": True,
                "message.timeout.ms": DELIVERY_TIMEOUT_MS,
            },
            # Sin esto, librdkafka escribe en texto plano por stderr y no en JSON.
            logger=logger,
        )

    def publish(self, messages: list[OutboxMessage]) -> set[UUID]:
        delivered: set[UUID] = set()

        def on_delivery(message_id: UUID):
            def callback(error: KafkaError | None, _message: object) -> None:
                if error is None:
                    delivered.add(message_id)
                else:
                    logger.warning("Kafka no confirmó el evento %s: %s", message_id, error)

            return callback

        for message in messages:
            try:
                self._producer.produce(
                    message.topic,
                    key=message.aggregate_id.encode(),
                    value=json.dumps(message.envelope, ensure_ascii=False).encode(),
                    on_delivery=on_delivery(message.id),
                )
            except (BufferError, KafkaException) as error:
                logger.warning("No se pudo encolar el evento %s: %s", message.id, error)
        self._producer.flush(FLUSH_TIMEOUT_SECONDS)
        return delivered
