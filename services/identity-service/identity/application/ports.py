"""Puertos de salida de la capa de aplicación. La infraestructura los implementa."""

from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    """Hora actual inyectable, para que los tests no dependan de la hora real."""

    def now(self) -> datetime: ...
