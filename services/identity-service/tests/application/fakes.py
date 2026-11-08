"""Dobles de prueba de los puertos: repositorio en memoria, hasher, emisor de tokens y reloj."""

import dataclasses
from datetime import UTC, datetime
from uuid import UUID, uuid4

from identity.application.dto import TokenPair, UserDirectoryEntry, UserDirectoryPage
from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered, InvalidRefreshToken
from identity.domain.events import UserRegistered
from identity.domain.password import RawPassword
from identity.domain.refresh_token import RefreshToken, RefreshTokenLedger
from identity.domain.repository import UserRepository
from identity.domain.role import Role
from identity.domain.user import User


class InMemoryUserRepository(UserRepository):
    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.saved_events: list[UserRegistered] = []

    def exists_with_email(self, email: Email) -> bool:
        return email.value in self.users

    def get_by_email(self, email: Email) -> User | None:
        return self.users.get(email.value)

    def get_by_id(self, user_id: UUID) -> User | None:
        return next((user for user in self.users.values() if user.id == user_id), None)

    def update_password_hash(self, user: User, previous_hash: str) -> None:
        if self.users[user.email.value].password_hash == previous_hash:
            self.users[user.email.value] = user

    def add(self, user: User) -> None:
        if user.email.value in self.users:
            raise EmailAlreadyRegistered("Ya existe un usuario con ese email.")
        self.users[user.email.value] = user
        self.saved_events.extend(user.pull_events())

    def update_roles(self, user: User) -> None:
        stored = self.users[user.email.value]
        self.users[user.email.value] = dataclasses.replace(stored, roles=user.roles)

    def update_active(self, user: User) -> None:
        stored = self.users[user.email.value]
        self.users[user.email.value] = dataclasses.replace(stored, is_active=user.is_active)

    def list_users(self, *, page: int, size: int, role: Role | None) -> UserDirectoryPage:
        found = [user for user in self.users.values() if role is None or role in user.roles]
        offset = (page - 1) * size
        return UserDirectoryPage(
            data=[
                UserDirectoryEntry(
                    id=user.id,
                    email=user.email.value,
                    full_name=user.full_name.value,
                    roles=sorted(item.value for item in user.roles),
                    active=user.is_active,
                    registered_at=user.registered_at,
                )
                for user in found[offset : offset + size]
            ],
            number=page,
            size=size,
            total_elements=len(found),
        )


class FakePasswordHasher:
    def __init__(self) -> None:
        self.calls = 0
        self.verify_calls = 0

    def hash(self, password: RawPassword) -> str:
        self.calls += 1
        return f"hashed::{password.value}"

    def verify(self, raw_password: str, password_hash: str | None) -> bool:
        self.verify_calls += 1
        return password_hash in (f"hashed::{raw_password}", f"viejo::{raw_password}")

    def needs_rehash(self, password_hash: str) -> bool:
        return password_hash.startswith("viejo::")

    def rehash(self, raw_password: str) -> str:
        return f"hashed::{raw_password}"


class FakeTokenIssuer:
    def __init__(self) -> None:
        self.renewed: list[RefreshToken] = []

    def issue(self, user: User, renewing: RefreshToken | None = None) -> TokenPair:
        if renewing is not None:
            self.renewed.append(renewing)
        return TokenPair(
            access_token=f"access-for-{user.id}",
            refresh_token=f"refresh-for-{user.id}",
            expires_in=900,
        )


class FakeRefreshTokenVerifier:
    """Conoce los tokens registrados en `tokens`; cualquier otro es inválido."""

    def __init__(self) -> None:
        self.tokens: dict[str, RefreshToken] = {}

    def verify(self, raw_token: str) -> RefreshToken:
        try:
            return self.tokens[raw_token]
        except KeyError:
            raise InvalidRefreshToken() from None


class InMemoryRefreshTokenLedger(RefreshTokenLedger):
    def __init__(self) -> None:
        self.used: set[UUID] = set()
        self.revoked: set[UUID] = set()

    def is_family_revoked(self, family_id: UUID) -> bool:
        return family_id in self.revoked

    def mark_used(self, token: RefreshToken) -> bool:
        if token.jti in self.used:
            return False
        self.used.add(token.jti)
        return True

    def revoke_family(self, family_id: UUID, now: datetime) -> None:
        self.revoked.add(family_id)


def a_refresh_token(user_id: UUID | None = None, family_id: UUID | None = None) -> RefreshToken:
    return RefreshToken(
        jti=uuid4(),
        user_id=user_id or uuid4(),
        family_id=family_id or uuid4(),
        expires_at=datetime(2026, 11, 10, tzinfo=UTC),
        session_started_at=datetime(2026, 11, 1, tzinfo=UTC),
    )


class FixedClock:
    def __init__(self, now: datetime = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now
