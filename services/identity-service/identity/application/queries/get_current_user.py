from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from identity.domain.errors import InvalidAccessToken
from identity.domain.repository import UserRepository


@dataclass(frozen=True, slots=True)
class GetCurrentUserQuery:
    user_id: UUID


@dataclass(frozen=True, slots=True)
class UserProfile:
    """Lo que un usuario puede ver de sí mismo. Sin el hash de la contraseña."""

    id: UUID
    email: str
    full_name: str
    roles: list[str]
    registered_at: datetime


class GetCurrentUserHandler:
    def __init__(self, *, users: UserRepository):
        self._users = users

    def handle(self, query: GetCurrentUserQuery) -> UserProfile:
        user = self._users.get_by_id(query.user_id)
        # El access token sigue vigente hasta su exp, pero el usuario pudo desactivarse o borrarse.
        if user is None or not user.is_active:
            raise InvalidAccessToken()
        return UserProfile(
            id=user.id,
            email=user.email.value,
            full_name=user.full_name.value,
            roles=sorted(role.value for role in user.roles),
            registered_at=user.registered_at,
        )
