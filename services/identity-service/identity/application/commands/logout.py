from dataclasses import dataclass, field

from identity.application.ports import Clock, RefreshTokenVerifier
from identity.domain.refresh_token import RefreshTokenLedger


@dataclass(frozen=True, slots=True)
class LogoutCommand:
    refresh_token: str = field(repr=False)


class LogoutHandler:
    """Cierra una sesión: revoca la familia del token. Es idempotente y no afecta otras sesiones."""

    def __init__(self, *, verifier: RefreshTokenVerifier, ledger: RefreshTokenLedger, clock: Clock):
        self._verifier = verifier
        self._ledger = ledger
        self._clock = clock

    def handle(self, command: LogoutCommand) -> None:
        token = self._verifier.verify(command.refresh_token)
        self._ledger.revoke_family(token.family_id, self._clock.now())
