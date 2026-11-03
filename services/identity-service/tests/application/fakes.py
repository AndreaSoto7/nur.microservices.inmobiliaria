"""Dobles de prueba de los puertos: repositorio en memoria, hasher y reloj falsos."""

from datetime import UTC, datetime

from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.password import RawPassword
from identity.domain.repository import UserRepository
from identity.domain.user import User


class InMemoryUserRepository(UserRepository):
    def __init__(self) -> None:
        self.users: dict[str, User] = {}

    def exists_with_email(self, email: Email) -> bool:
        return email.value in self.users

    def add(self, user: User) -> None:
        if user.email.value in self.users:
            raise EmailAlreadyRegistered("Ya existe un usuario con ese email.")
        self.users[user.email.value] = user


class FakePasswordHasher:
    def __init__(self) -> None:
        self.calls = 0

    def hash(self, password: RawPassword) -> str:
        self.calls += 1
        return f"hashed::{password.value}"


class FixedClock:
    def __init__(self, now: datetime = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now
