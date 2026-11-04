from abc import ABC, abstractmethod
from uuid import UUID

from identity.domain.email import Email
from identity.domain.user import User


class UserRepository(ABC):
    """Puerto de persistencia del aggregate User. La implementación vive en infrastructure."""

    @abstractmethod
    def exists_with_email(self, email: Email) -> bool: ...

    @abstractmethod
    def get_by_email(self, email: Email) -> User | None: ...

    @abstractmethod
    def get_by_id(self, user_id: UUID) -> User | None: ...

    @abstractmethod
    def update_password_hash(self, user: User) -> None: ...

    @abstractmethod
    def add(self, user: User) -> None:
        """Guarda un usuario nuevo. Lanza EmailAlreadyRegistered si el email ya existe."""
