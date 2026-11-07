import pytest

from identity.application.commands.register_user import RegisterUserCommand, RegisterUserHandler
from identity.domain.errors import (
    EmailAlreadyRegistered,
    InvalidFullName,
    RoleNotAllowed,
    WeakPassword,
)
from identity.domain.full_name import FullName
from identity.domain.role import Role
from tests.application.fakes import FakePasswordHasher, FixedClock, InMemoryUserRepository


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture
def handler(users, hasher) -> RegisterUserHandler:
    return RegisterUserHandler(users=users, password_hasher=hasher, clock=FixedClock())


def a_command(**overrides) -> RegisterUserCommand:
    data = {
        "email": "Ana.Perez@Example.com",
        "password": "S3gura-2026",
        "full_name": "Ana Pérez",
    }
    return RegisterUserCommand(**(data | overrides))


def test_saves_the_user_with_hashed_password_and_returns_its_id(handler, users):
    user_id = handler.handle(a_command())

    saved = users.users["ana.perez@example.com"]
    assert saved.id == user_id
    assert saved.password_hash == "hashed::S3gura-2026"
    assert saved.full_name == FullName("Ana Pérez")


def test_without_role_uses_default_role_client(handler, users):
    handler.handle(a_command(role=None))

    assert users.users["ana.perez@example.com"].roles == frozenset({Role.CLIENT})


def test_allows_registering_as_agent(handler, users):
    handler.handle(a_command(role="AGENT"))

    assert users.users["ana.perez@example.com"].roles == frozenset({Role.AGENT})


def test_rejects_an_already_registered_email_regardless_of_case(handler, users):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered) as error:
        handler.handle(a_command(email="ANA.PEREZ@example.com"))

    assert error.value.code == "USER_EMAIL_ALREADY_REGISTERED"
    assert len(users.users) == 1


def test_duplicate_email_error_does_not_include_the_email(handler):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered) as error:
        handler.handle(a_command())

    assert "ana.perez@example.com" not in error.value.message.lower()


def test_saves_nothing_when_the_password_is_weak(handler, users):
    with pytest.raises(WeakPassword):
        handler.handle(a_command(password="corta"))

    assert users.users == {}


def test_does_not_allow_self_assigning_admin(handler, users):
    with pytest.raises(RoleNotAllowed):
        handler.handle(a_command(role="ADMIN"))

    assert users.users == {}


@pytest.mark.parametrize(
    "overrides",
    [{"full_name": "   "}, {"role": "ADMIN"}, {"role": "FOO"}, {"password": "corta"}],
)
def test_does_not_hash_when_data_is_invalid(handler, hasher, overrides):
    # Hashear con PBKDF2 es caro: los datos inválidos no deben gastar CPU.
    with pytest.raises((InvalidFullName, RoleNotAllowed, WeakPassword)):
        handler.handle(a_command(**overrides))

    assert hasher.calls == 0


def test_does_not_hash_when_the_email_already_exists(handler, hasher):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered):
        handler.handle(a_command())

    assert hasher.calls == 1


def test_register_leaves_the_user_registered_event_to_publish(handler, users):
    user_id = handler.handle(a_command())

    (event,) = users.saved_events
    assert event.user_id == user_id
    assert event.email == "ana.perez@example.com"
