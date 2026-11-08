import dataclasses
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from identity.domain.email import Email
from identity.domain.errors import (
    AdminRequired,
    InvalidCredentials,
    OwnAccountProtected,
    RoleNotAllowed,
)
from identity.domain.events import UserRegistered
from identity.domain.full_name import FullName
from identity.domain.role import ROLE_NOT_ALLOWED_MESSAGE, SELF_REGISTRABLE_ROLES, Role


@dataclass(frozen=True, eq=False)
class User:
    """Aggregate root de identity.

    Es inmutable: nadie puede cambiar roles ni estado desde afuera. Los cambios futuros
    (desactivar, cambiar de rol) serán métodos del aggregate que validen sus reglas.
    Recibe la contraseña ya hasheada, porque hashear es un puerto de aplicación.
    """

    id: UUID
    email: Email
    full_name: FullName
    password_hash: str = field(repr=False)
    roles: frozenset[Role]
    is_active: bool
    registered_at: datetime
    _events: list[UserRegistered] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        # Invariante que vale siempre, también al reconstruir el usuario desde la base. No es un
        # error de negocio: si pasa, es un bug o un dato corrupto, y debe terminar en un 500.
        if not self.roles:
            raise ValueError("Un usuario tiene al menos un rol.")

    @classmethod
    def register(
        cls,
        *,
        email: Email,
        full_name: FullName,
        password_hash: str,
        role: Role,
        now: datetime,
    ) -> "User":
        if role not in SELF_REGISTRABLE_ROLES:
            raise RoleNotAllowed(ROLE_NOT_ALLOWED_MESSAGE)

        user = cls(
            id=uuid4(),
            email=email,
            full_name=full_name,
            password_hash=password_hash,
            roles=frozenset({role}),
            is_active=True,
            registered_at=now,
        )
        user._events.append(
            UserRegistered(
                user_id=user.id,
                email=email.value,
                full_name=full_name.value,
                roles=tuple(sorted(user.roles)),
                occurred_at=now,
            )
        )
        return user

    def ensure_can_authenticate(self) -> None:
        # Mismo error que una contraseña incorrecta: no se revela que la cuenta existe.
        if not self.is_active:
            raise InvalidCredentials()

    def ensure_is_admin(self) -> None:
        if Role.ADMIN not in self.roles:
            raise AdminRequired()

    def assign_roles(self, roles: frozenset[Role], *, assigned_by: UUID) -> "User":
        """El mismo usuario con otros roles. Reemplaza la lista completa."""
        if not roles:
            raise RoleNotAllowed("Un usuario tiene al menos un rol.")
        if assigned_by == self.id and Role.ADMIN not in roles:
            raise OwnAccountProtected("No puedes quitarte el rol de administrador.")
        return dataclasses.replace(self, roles=roles)

    def deactivate(self, *, deactivated_by: UUID) -> "User":
        if deactivated_by == self.id:
            raise OwnAccountProtected("No puedes desactivar tu propia cuenta.")
        return dataclasses.replace(self, is_active=False)

    def activate(self) -> "User":
        return dataclasses.replace(self, is_active=True)

    def with_password_hash(self, password_hash: str) -> "User":
        """El mismo usuario con otro hash. La contraseña no cambia: solo cómo se guarda."""
        return dataclasses.replace(self, password_hash=password_hash)

    def pull_events(self) -> list[UserRegistered]:
        """Entrega los eventos registrados y los olvida (se despachan una sola vez)."""
        events = list(self._events)
        self._events.clear()
        return events

    def __eq__(self, other: object) -> bool:
        return isinstance(other, User) and other.id == self.id

    def __hash__(self) -> int:
        return hash(self.id)
