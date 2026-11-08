from dataclasses import dataclass
from uuid import UUID

from identity.application.authorization import require_admin
from identity.application.dto import UserDirectoryPage
from identity.application.ports import UserDirectory
from identity.domain.repository import UserRepository
from identity.domain.role import Role


@dataclass(frozen=True, slots=True)
class ListUsersQuery:
    actor_id: UUID
    page: int
    size: int
    role: Role | None = None


class ListUsersHandler:
    def __init__(self, *, users: UserRepository, directory: UserDirectory):
        self._users = users
        self._directory = directory

    def handle(self, query: ListUsersQuery) -> UserDirectoryPage:
        require_admin(self._users, query.actor_id)
        return self._directory.list_users(page=query.page, size=query.size, role=query.role)
