"""Rotación de refresh tokens: cada uno sirve una sola vez, y reutilizarlo revoca su familia."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from identity.domain.errors import InvalidRefreshToken


@dataclass(frozen=True, slots=True)
class RefreshToken:
    """Datos de un refresh token ya verificado (firma, audiencia y vencimiento)."""

    jti: UUID
    user_id: UUID
    family_id: UUID
    expires_at: datetime


class RefreshTokenLedger(ABC):
    """Registro de los tokens usados y las familias revocadas. Puerto de persistencia."""

    @abstractmethod
    def is_family_revoked(self, family_id: UUID) -> bool: ...

    @abstractmethod
    def mark_used(self, token: RefreshToken) -> bool:
        """Marca el token como usado, de forma atómica. Devuelve False si ya lo estaba."""

    @abstractmethod
    def revoke_family(self, family_id: UUID, now: datetime) -> None:
        """Revoca la familia. Es idempotente."""


def consume(token: RefreshToken, ledger: RefreshTokenLedger, now: datetime) -> None:
    """Gasta el token. Si ya se había usado es señal de robo: se revoca toda la familia."""
    if ledger.is_family_revoked(token.family_id):
        raise InvalidRefreshToken()
    if not ledger.mark_used(token):
        ledger.revoke_family(token.family_id, now)
        raise InvalidRefreshToken()
