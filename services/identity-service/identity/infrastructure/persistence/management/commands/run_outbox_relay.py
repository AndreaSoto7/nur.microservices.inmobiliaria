"""Publica en Kafka los eventos del outbox. Corre como proceso aparte del servidor HTTP."""

import logging
import signal
import threading
from datetime import UTC, datetime

from confluent_kafka import KafkaException
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections

from identity import container
from identity.infrastructure.messaging.relay import EventProducer, publish_pending

logger = logging.getLogger(__name__)


def publish_once(producer: EventProducer) -> int:
    """Publica un lote. La base o Kafka pueden volver: esos errores no deben tumbar el relay."""
    try:
        close_old_connections()
        return publish_pending(producer, now=datetime.now(UTC))
    except (DatabaseError, KafkaException):
        logger.exception("Error en el relay del outbox")
        return 0


class Command(BaseCommand):
    help = "Publica en Kafka los eventos pendientes del outbox."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--once", action="store_true", help="Publica un lote y termina.")

    def handle(self, *args, once: bool, **options) -> None:
        producer = container.event_producer()
        if once:
            publish_pending(producer, now=datetime.now(UTC))
            return

        stop = threading.Event()
        signal.signal(signal.SIGTERM, lambda *_: stop.set())
        signal.signal(signal.SIGINT, lambda *_: stop.set())
        logger.info("Relay del outbox iniciado")
        while not stop.is_set():
            if publish_once(producer) == 0:
                stop.wait(settings.OUTBOX_POLL_SECONDS)
        logger.info("Relay del outbox detenido")
