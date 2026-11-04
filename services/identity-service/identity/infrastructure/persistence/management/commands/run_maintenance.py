"""Borra periódicamente las filas vencidas. Corre como proceso aparte del servidor HTTP."""

import logging
import signal
import threading
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections

from identity.infrastructure.persistence.maintenance import purge_expired

logger = logging.getLogger(__name__)


def purge_once() -> None:
    """Hace una limpieza. La base puede volver: un error no debe tumbar el proceso."""
    try:
        close_old_connections()
        result = purge_expired(
            now=datetime.now(UTC),
            session_max=timedelta(seconds=settings.JWT_SESSION_MAX_SECONDS),
            outbox_retention=timedelta(seconds=settings.OUTBOX_RETENTION_SECONDS),
        )
    except DatabaseError:
        logger.exception("Error en la limpieza")
        return
    logger.info(
        "Limpieza terminada: %d tokens usados, %d familias revocadas, %d eventos publicados",
        result.used_tokens,
        result.revoked_families,
        result.outbox_messages,
    )


class Command(BaseCommand):
    help = "Borra los tokens usados, las familias revocadas y los eventos publicados ya vencidos."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--once", action="store_true", help="Limpia una vez y termina.")

    def handle(self, *args, once: bool, **options) -> None:
        if once:
            purge_once()
            return

        stop = threading.Event()
        signal.signal(signal.SIGTERM, lambda *_: stop.set())
        signal.signal(signal.SIGINT, lambda *_: stop.set())
        logger.info("Limpieza periódica iniciada")
        while not stop.is_set():
            purge_once()
            stop.wait(settings.MAINTENANCE_INTERVAL_SECONDS)
        logger.info("Limpieza periódica detenida")
