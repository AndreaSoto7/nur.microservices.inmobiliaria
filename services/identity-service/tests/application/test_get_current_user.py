import dataclasses
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from identity.application.queries.get_current_user import (
    GetCurrentUserHandler,
    GetCurrentUserQuery,
    UserProfile,
)
from identity.domain.email import Email
from identity.domain.errors import InvalidAccessToken
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from tests.application.fakes import InMemoryUserRepository

NOW = datetime(2026, 11, 3, tzinfo=UTC)


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def user(users) -> User:
    user = User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="secreto",
        role=Role.AGENT,
        now=NOW,
    )
    users.add(user)
    return user


def test_devuelve_el_perfil_sin_datos_sensibles(users, user):
    profile = GetCurrentUserHandler(users=users).handle(GetCurrentUserQuery(user_id=user.id))

    assert profile == UserProfile(
        id=user.id,
        email="ana@example.com",
        full_name="Ana Pérez",
        roles=["AGENT"],
        registered_at=NOW,
    )
    assert "secreto" not in repr(profile)


def test_un_usuario_que_ya_no_existe_es_un_token_invalido(users):
    with pytest.raises(InvalidAccessToken) as error:
        GetCurrentUserHandler(users=users).handle(GetCurrentUserQuery(user_id=uuid4()))

    assert error.value.code == "AUTH_INVALID_TOKEN"


def test_un_usuario_inactivo_es_un_token_invalido(users, user):
    users.users[user.email.value] = dataclasses.replace(user, is_active=False)

    with pytest.raises(InvalidAccessToken):
        GetCurrentUserHandler(users=users).handle(GetCurrentUserQuery(user_id=user.id))
