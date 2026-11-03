"""Puertos de salida de la capa de aplicación. La infraestructura los implementa."""

from datetime import datetime
from typing import Protocol

from identity.domain.password import RawPassword


class Clock(Protocol):
    """Hora actual inyectable, para que los tests no dependan de la hora real."""

    def now(self) -> datetime: ...


class PasswordHasher(Protocol):
    # Recibe RawPassword, no str: solo se hashea una contraseña que ya pasó la política.
    def hash(self, password: RawPassword) -> str: ...
