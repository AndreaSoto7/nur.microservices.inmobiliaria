from dataclasses import dataclass, field

from identity.application.dto import TokenPair
from identity.application.ports import Clock, RefreshTokenVerifier, TokenIssuer
from identity.domain.errors import InvalidCredentials, InvalidRefreshToken
from identity.domain.refresh_token import RefreshTokenLedger, consume
from identity.domain.repository import UserRepository


@dataclass(frozen=True, slots=True)
class RefreshTokensCommand:
    refresh_token: str = field(repr=False)


class RefreshTokensHandler:
    """Comando: gasta un refresh token y emite un par nuevo de la misma familia.

    Devuelve los tokens porque son el resultado de la operación, no un dato de lectura: no hay
    otra forma de entregárselos al cliente.
    """

    def __init__(
        self,
        *,
        users: UserRepository,
        verifier: RefreshTokenVerifier,
        ledger: RefreshTokenLedger,
        token_issuer: TokenIssuer,
        clock: Clock,
    ):
        self._users = users
        self._verifier = verifier
        self._ledger = ledger
        self._token_issuer = token_issuer
        self._clock = clock

    def handle(self, command: RefreshTokensCommand) -> TokenPair:
        token = self._verifier.verify(command.refresh_token)

        user = self._users.get_by_id(token.user_id)
        if user is None:
            raise InvalidRefreshToken()
        try:
            user.ensure_can_authenticate()
        except InvalidCredentials:
            raise InvalidRefreshToken() from None

        consume(token, self._ledger, self._clock.now())
        return self._token_issuer.issue(user, family_id=token.family_id)
