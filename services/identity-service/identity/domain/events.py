"""Eventos de dominio. infrastructure los traduce a eventos de integración (contracts/events/)."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class UserRegistered:
    user_id: UUID
    email: str
    full_name: str
    roles: tuple[str, ...]
    occurred_at: datetime
