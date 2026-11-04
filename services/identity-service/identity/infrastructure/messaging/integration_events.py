"""Traduce eventos de dominio a eventos de integración (contracts/events/)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from identity.application.correlation import correlation_id
from identity.domain.events import UserRegistered

USER_TOPIC = "identity.user.events"
PRODUCER = "identity-service"


@dataclass(frozen=True, slots=True)
class IntegrationEvent:
    event_id: UUID
    topic: str
    key: str
    envelope: dict


def _utc_iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


def to_integration_event(event: UserRegistered) -> IntegrationEvent:
    event_id = uuid4()
    aggregate_id = str(event.user_id)
    return IntegrationEvent(
        event_id=event_id,
        topic=USER_TOPIC,
        # La clave es el aggregateId: Kafka conserva el orden de los eventos de un mismo usuario.
        key=aggregate_id,
        envelope={
            "eventId": str(event_id),
            "eventType": "UserRegistered",
            "eventVersion": 1,
            "occurredAt": _utc_iso(event.occurred_at),
            "producer": PRODUCER,
            "aggregateType": "User",
            "aggregateId": aggregate_id,
            "correlationId": correlation_id.get() or str(uuid4()),
            "payload": {
                "userId": aggregate_id,
                "email": event.email,
                "fullName": event.full_name,
                "roles": list(event.roles),
                "registeredAt": _utc_iso(event.occurred_at),
            },
        },
    )
