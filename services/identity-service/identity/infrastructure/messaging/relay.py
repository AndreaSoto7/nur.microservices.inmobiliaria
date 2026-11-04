"""Relay del outbox: publica en Kafka lo pendiente y marca solo lo que Kafka confirmó."""

from datetime import datetime
from typing import Protocol
from uuid import UUID

from django.db import transaction

from identity.infrastructure.persistence.models import OutboxMessage

BATCH_SIZE = 100


class EventProducer(Protocol):
    def publish(self, messages: list[OutboxMessage]) -> set[UUID]:
        """Publica los mensajes y devuelve los ids que Kafka confirmó."""
        ...


def publish_pending(producer: EventProducer, *, now: datetime, batch_size: int = BATCH_SIZE) -> int:
    """Publica un lote. Es entrega al menos una vez: si falla al marcar, se reenvía.

    `skip_locked` permite correr más de un relay sin que publiquen lo mismo a la vez.
    """
    with transaction.atomic():
        messages = list(
            OutboxMessage.objects.select_for_update(skip_locked=True)
            .filter(published_at__isnull=True)
            .order_by("created_at")[:batch_size]
        )
        if not messages:
            return 0
        delivered = producer.publish(messages)
        OutboxMessage.objects.filter(id__in=delivered).update(published_at=now)
    return len(delivered)
