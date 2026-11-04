from dataclasses import dataclass, field

from identity.application.dto import TokenPair
from identity.application.ports import PasswordHasher, TokenIssuer
from identity.domain.email import Email
from identity.domain.errors import InvalidCredentials, InvalidEmail
from identity.domain.repository import UserRepository


@dataclass(frozen=True, slots=True)
class AuthenticateUserCommand:
    email: str
    password: str = field(repr=False)


class AuthenticateUserHandler:
    """Comando: valida credenciales y devuelve un par de tokens.

    Devuelve los tokens porque son el resultado de la operación, no un dato de lectura. Es un
    comando porque puede cambiar estado: actualiza el hash si quedó con parámetros viejos. Así los
    hashes viejos no tardan menos que uno actual, lo que permitiría detectar cuentas por tiempo.

    Un email inexistente, una contraseña incorrecta y un usuario inactivo dan el mismo error, con
    el mismo mensaje y un tiempo parecido: no se revela qué emails están registrados.
    """

    def __init__(
        self, *, users: UserRepository, password_hasher: PasswordHasher, token_issuer: TokenIssuer
    ):
        self._users = users
        self._password_hasher = password_hasher
        self._token_issuer = token_issuer

    def handle(self, command: AuthenticateUserCommand) -> TokenPair:
        try:
            user = self._users.get_by_email(Email(command.email))
        except InvalidEmail:
            user = None

        password_hash = user.password_hash if user is not None else None
        if not self._password_hasher.verify(command.password, password_hash) or user is None:
            raise InvalidCredentials()

        user.ensure_can_authenticate()
        if self._password_hasher.needs_rehash(user.password_hash):
            self._users.update_password_hash(
                user.with_password_hash(self._password_hasher.rehash(command.password))
            )
        return self._token_issuer.issue(user)
