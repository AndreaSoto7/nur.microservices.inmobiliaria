from dataclasses import dataclass, field
from uuid import UUID

from identity.application.ports import Clock, PasswordHasher
from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.full_name import FullName
from identity.domain.password import RawPassword
from identity.domain.repository import UserRepository
from identity.domain.role import self_registration_role
from identity.domain.user import User

EMAIL_ALREADY_REGISTERED_MESSAGE = "Ya existe un usuario con ese email."


@dataclass(frozen=True, slots=True)
class RegisterUserCommand:
    email: str
    password: str = field(repr=False)
    full_name: str
    role: str | None = None


class RegisterUserHandler:
    """Comando CQRS: crea el usuario y devuelve solo su ID."""

    def __init__(self, *, users: UserRepository, password_hasher: PasswordHasher, clock: Clock):
        self._users = users
        self._password_hasher = password_hasher
        self._clock = clock

    def handle(self, command: RegisterUserCommand) -> UUID:
        # Todo se valida antes de hashear: PBKDF2 es caro y no debe gastarse en datos inválidos.
        email = Email(command.email)
        full_name = FullName(command.full_name)
        password = RawPassword(command.password)
        role = self_registration_role(command.role)

        # Chequeo temprano para dar un error claro. El índice único de la base cubre la carrera
        # entre dos registros simultáneos: el repositorio también lanza EmailAlreadyRegistered.
        if self._users.exists_with_email(email):
            raise EmailAlreadyRegistered(EMAIL_ALREADY_REGISTERED_MESSAGE)

        user = User.register(
            email=email,
            full_name=full_name,
            password_hash=self._password_hasher.hash(password),
            role=role,
            now=self._clock.now(),
        )
        self._users.add(user)
        return user.id
