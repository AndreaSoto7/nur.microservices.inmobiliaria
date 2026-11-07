import dataclasses

import pytest

from identity.application.commands.authenticate_user import (
    AuthenticateUserCommand,
    AuthenticateUserHandler,
)
from identity.application.commands.register_user import RegisterUserCommand, RegisterUserHandler
from identity.application.dto import TokenPair
from identity.domain.errors import InvalidCredentials
from tests.application.fakes import (
    FakePasswordHasher,
    FakeTokenIssuer,
    FixedClock,
    InMemoryUserRepository,
)

PASSWORD = "S3gura-2026"


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture(autouse=True)
def user_id(users, hasher):
    register = RegisterUserHandler(users=users, password_hasher=hasher, clock=FixedClock())
    return register.handle(
        RegisterUserCommand(email="ana@example.com", password=PASSWORD, full_name="Ana Pérez")
    )


@pytest.fixture
def handler(users, hasher) -> AuthenticateUserHandler:
    return AuthenticateUserHandler(
        users=users, password_hasher=hasher, token_issuer=FakeTokenIssuer()
    )


def test_valid_credentials_return_the_token_pair(handler, user_id):
    tokens = handler.handle(AuthenticateUserCommand(email="ana@example.com", password=PASSWORD))

    assert tokens == TokenPair(
        access_token=f"access-for-{user_id}",
        refresh_token=f"refresh-for-{user_id}",
        expires_in=900,
    )
    assert tokens.token_type == "Bearer"


def test_email_is_case_insensitive(handler, user_id):
    tokens = handler.handle(AuthenticateUserCommand(email="ANA@Example.com", password=PASSWORD))

    assert tokens.access_token == f"access-for-{user_id}"


def test_wrong_password_gives_invalid_credentials(handler, user_id):
    with pytest.raises(InvalidCredentials) as error:
        handler.handle(AuthenticateUserCommand(email="ana@example.com", password="otra-clave"))

    assert error.value.code == "AUTH_INVALID_CREDENTIALS"


def test_unknown_email_gives_the_same_error_and_message(handler, user_id):
    with pytest.raises(InvalidCredentials) as wrong_password:
        handler.handle(AuthenticateUserCommand(email="ana@example.com", password="otra-clave"))
    with pytest.raises(InvalidCredentials) as unknown_email:
        handler.handle(AuthenticateUserCommand(email="nadie@example.com", password=PASSWORD))

    assert unknown_email.value.message == wrong_password.value.message


def test_unknown_email_still_verifies_a_password_to_avoid_timing_leaks(handler, hasher, user_id):
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserCommand(email="nadie@example.com", password=PASSWORD))

    assert hasher.verify_calls == 1


def test_malformed_email_gives_invalid_credentials(handler):
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserCommand(email="no-es-un-email", password=PASSWORD))


def test_inactive_user_gets_no_tokens(handler, users, user_id):
    users.users["ana@example.com"] = dataclasses.replace(
        users.users["ana@example.com"], is_active=False
    )

    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserCommand(email="ana@example.com", password=PASSWORD))


def test_password_policy_is_not_applied_on_login(handler, user_id):
    # Una contraseña corta no es "débil" en el login: simplemente no coincide.
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserCommand(email="ana@example.com", password="x"))


def test_query_does_not_show_the_password_in_repr():
    assert PASSWORD not in repr(AuthenticateUserCommand(email="a@b.com", password=PASSWORD))


def test_updates_the_hash_when_the_algorithm_is_outdated(handler, users):
    email = "ana@example.com"
    users.users[email] = dataclasses.replace(users.users[email], password_hash=f"viejo::{PASSWORD}")

    handler.handle(AuthenticateUserCommand(email=email, password=PASSWORD))

    assert users.users[email].password_hash == f"hashed::{PASSWORD}"


def test_does_not_touch_the_hash_when_the_password_is_wrong(handler, users):
    email = "ana@example.com"
    users.users[email] = dataclasses.replace(users.users[email], password_hash=f"viejo::{PASSWORD}")

    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserCommand(email=email, password="otra-clave"))

    assert users.users[email].password_hash == f"viejo::{PASSWORD}"


def test_does_not_touch_the_hash_when_it_is_up_to_date(handler, users):
    before = users.users["ana@example.com"]

    handler.handle(AuthenticateUserCommand(email="ana@example.com", password=PASSWORD))

    assert users.users["ana@example.com"] is before
