import dataclasses
from datetime import UTC, datetime

import pytest

from identity.domain.email import Email
from identity.domain.errors import (
    InvalidCredentials,
    InvalidFullName,
    RoleNotAllowed,
    WeakPassword,
)
from identity.domain.events import UserRegistered
from identity.domain.full_name import FullName
from identity.domain.password import RawPassword
from identity.domain.role import DEFAULT_SELF_REGISTRATION_ROLE, Role, self_registration_role
from identity.domain.user import User

NOW = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


def register(role: Role = Role.CLIENT) -> User:
    return User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="hash-de-prueba",
        role=role,
        now=NOW,
    )


def test_registers_an_active_user_with_its_role():
    user = register(role=Role.AGENT)

    assert user.email == Email("ana@example.com")
    assert user.full_name == FullName("Ana Pérez")
    assert user.password_hash == "hash-de-prueba"
    assert user.roles == frozenset({Role.AGENT})
    assert user.is_active is True
    assert user.registered_at == NOW


def test_generates_a_different_id_per_user():
    assert register().id != register().id


def test_register_emits_user_registered():
    user = register()

    events = user.pull_events()

    assert events == [
        UserRegistered(
            user_id=user.id,
            email="ana@example.com",
            full_name="Ana Pérez",
            roles=("CLIENT",),
            occurred_at=NOW,
        )
    ]


def test_pull_events_empties_the_list():
    user = register()
    user.pull_events()

    assert user.pull_events() == []


def test_does_not_allow_registering_as_admin():
    with pytest.raises(RoleNotAllowed) as error:
        register(role=Role.ADMIN)

    assert error.value.code == "USER_ROLE_NOT_ALLOWED"


def test_roles_cannot_be_changed_from_outside():
    user = register()

    with pytest.raises(dataclasses.FrozenInstanceError):
        user.roles = frozenset({Role.ADMIN})


def test_user_always_has_at_least_one_role():
    # Es una invariante, no un error de negocio: si pasa, es un bug o un dato corrupto (500).
    with pytest.raises(ValueError):
        User(
            id=register().id,
            email=Email("ana@example.com"),
            full_name=FullName("Ana Pérez"),
            password_hash="x",
            roles=frozenset(),
            is_active=True,
            registered_at=NOW,
        )


def test_password_hash_does_not_appear_in_repr():
    assert "hash-de-prueba" not in repr(register())


def test_two_users_are_equal_when_they_have_the_same_id():
    user = register()

    assert user == User(
        id=user.id,
        email=Email("otro@example.com"),
        full_name=FullName("Otro"),
        password_hash="x",
        roles=frozenset({Role.CLIENT}),
        is_active=True,
        registered_at=NOW,
    )


def test_default_self_registration_role_is_client():
    assert DEFAULT_SELF_REGISTRATION_ROLE is Role.CLIENT


def test_role_parse_accepts_the_role_name():
    assert Role.parse("AGENT") is Role.AGENT


def test_role_parse_rejects_unknown_roles_with_the_contract_text():
    with pytest.raises(RoleNotAllowed) as error:
        Role.parse("SUPERUSER")

    assert error.value.message == "Solo se puede registrar con rol CLIENT o AGENT."


def test_full_name_trims_spaces():
    assert FullName("  Ana Pérez  ").value == "Ana Pérez"


@pytest.mark.parametrize("raw", ["", "   ", "x" * 151])
def test_full_name_rejects_empty_or_too_long_names(raw):
    with pytest.raises(InvalidFullName) as error:
        FullName(raw)

    assert error.value.code == "USER_INVALID_FULL_NAME"


@pytest.mark.parametrize("raw", ["corta", "x" * 129, "x" * 5000])
def test_rejects_passwords_outside_8_to_128_characters(raw):
    with pytest.raises(WeakPassword) as error:
        RawPassword(raw)

    assert error.value.code == "USER_WEAK_PASSWORD"


def test_password_does_not_appear_in_repr():
    assert "S3gura-2026" not in repr(RawPassword("S3gura-2026"))


@pytest.mark.parametrize("value", [None, ""])
def test_self_registration_without_role_uses_client(value):
    assert self_registration_role(value) is Role.CLIENT


def test_self_registration_accepts_agent():
    assert self_registration_role("AGENT") is Role.AGENT


@pytest.mark.parametrize("value", ["ADMIN", "FOO"])
def test_self_registration_rejects_admin_and_unknown_roles(value):
    with pytest.raises(RoleNotAllowed):
        self_registration_role(value)


def test_active_user_can_authenticate():
    register().ensure_can_authenticate()


def test_inactive_user_cannot_authenticate():
    user = register()
    inactive = dataclasses.replace(user, is_active=False)

    with pytest.raises(InvalidCredentials) as error:
        inactive.ensure_can_authenticate()

    assert error.value.code == "AUTH_INVALID_CREDENTIALS"


def test_with_password_hash_returns_a_new_user_without_changing_the_original():
    user = register()

    updated = user.with_password_hash("otro-hash")

    assert updated.password_hash == "otro-hash"
    assert updated == user
    assert user.password_hash == "hash-de-prueba"
