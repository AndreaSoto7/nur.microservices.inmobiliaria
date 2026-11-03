from dataclasses import dataclass, field

from identity.application.dto import TokenPair
from identity.application.ports import PasswordHasher, TokenIssuer
from identity.domain.email import Email
from identity.domain.errors import InvalidCredentials, InvalidEmail
from identity.domain.repository import UserRepository


@dataclass(frozen=True, slots=True)
class AuthenticateUserQuery:
    email: str
    password: str = field(repr=False)


class AuthenticateUserHandler:
    """Consulta CQRS: no cambia estado. Valida credenciales y devuelve un par de tokens.

    Un email inexistente, una contraseña incorrecta y un usuario inactivo dan el mismo error, con
    el mismo mensaje y un tiempo parecido: no se revela qué emails están registrados.
    """

    def __init__(
        self, *, users: UserRepository, password_hasher: PasswordHasher, token_issuer: TokenIssuer
    ):
        self._users = users
        self._password_hasher = password_hasher
        self._token_issuer = token_issuer

    def handle(self, query: AuthenticateUserQuery) -> TokenPair:
        try:
            user = self._users.get_by_email(Email(query.email))
        except InvalidEmail:
            user = None

        password_hash = user.password_hash if user is not None else None
        if not self._password_hasher.verify(query.password, password_hash) or user is None:
            raise InvalidCredentials()

        user.ensure_can_authenticate()
        return self._token_issuer.issue(user)
