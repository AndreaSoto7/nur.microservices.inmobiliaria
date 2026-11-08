import math
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class UserDirectoryEntry:
    """Lo que un administrador ve de una cuenta. Nunca lleva la contraseña."""

    id: UUID
    email: str
    full_name: str
    roles: list[str]
    active: bool
    registered_at: datetime


@dataclass(frozen=True, slots=True)
class UserDirectoryPage:
    data: list[UserDirectoryEntry]
    number: int
    size: int
    total_elements: int

    @property
    def total_pages(self) -> int:
        return math.ceil(self.total_elements / self.size)


@dataclass(frozen=True, slots=True)
class TokenPair:
    """Resultado del login. Los tokens son credenciales: no aparecen en el repr."""

    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)
    expires_in: int
    token_type: str = "Bearer"  # noqa: S105 - es el tipo de token (RFC 6750), no un secreto
