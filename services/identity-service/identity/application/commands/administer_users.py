"""Comandos del panel de administración. Solo ADMIN, comprobado en la base en cada uno."""

import logging
from dataclasses import dataclass
from uuid import UUID

from identity.application.authorization import require_admin
from identity.domain.errors import UserNotFound
from identity.domain.repository import UserRepository
from identity.domain.role import Role
from identity.domain.user import User

logger = logging.getLogger(__name__)


def _get_target(users: UserRepository, user_id: UUID) -> User:
    user = users.get_by_id(user_id)
    if user is None:
        raise UserNotFound()
    return user


@dataclass(frozen=True, slots=True)
class AssignUserRolesCommand:
    actor_id: UUID
    user_id: UUID
    roles: tuple[str, ...]


class AssignUserRolesHandler:
    def __init__(self, *, users: UserRepository):
        self._users = users

    def handle(self, command: AssignUserRolesCommand) -> None:
        require_admin(self._users, command.actor_id)
        roles = frozenset(Role.parse(role) for role in command.roles)
        user = _get_target(self._users, command.user_id)
        self._users.update_roles(user.assign_roles(roles, assigned_by=command.actor_id))
        logger.info(
            "El administrador %s cambió los roles de %s a %s",
            command.actor_id,
            command.user_id,
            sorted(roles),
        )


@dataclass(frozen=True, slots=True)
class DeactivateUserCommand:
    actor_id: UUID
    user_id: UUID


class DeactivateUserHandler:
    def __init__(self, *, users: UserRepository):
        self._users = users

    def handle(self, command: DeactivateUserCommand) -> None:
        require_admin(self._users, command.actor_id)
        user = _get_target(self._users, command.user_id)
        self._users.update_active(user.deactivate(deactivated_by=command.actor_id))
        logger.info("El administrador %s desactivó a %s", command.actor_id, command.user_id)


@dataclass(frozen=True, slots=True)
class ActivateUserCommand:
    actor_id: UUID
    user_id: UUID


class ActivateUserHandler:
    def __init__(self, *, users: UserRepository):
        self._users = users

    def handle(self, command: ActivateUserCommand) -> None:
        require_admin(self._users, command.actor_id)
        user = _get_target(self._users, command.user_id)
        self._users.update_active(user.activate())
        logger.info("El administrador %s activó a %s", command.actor_id, command.user_id)
