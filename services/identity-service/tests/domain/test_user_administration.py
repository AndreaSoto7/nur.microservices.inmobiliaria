from datetime import UTC, datetime
from uuid import uuid4

import pytest

from identity.domain.email import Email
from identity.domain.errors import AdminRequired, OwnAccountProtected, RoleNotAllowed
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User

NOW = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


def a_user(*roles: Role, is_active: bool = True) -> User:
    return User(
        id=uuid4(),
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="hash-de-prueba",
        roles=frozenset(roles or {Role.CLIENT}),
        is_active=is_active,
        registered_at=NOW,
    )


def test_assign_roles_replaces_the_whole_list():
    user = a_user(Role.CLIENT)

    changed = user.assign_roles(frozenset({Role.AGENT, Role.ADMIN}), assigned_by=uuid4())

    assert changed.roles == frozenset({Role.AGENT, Role.ADMIN})
    assert changed.id == user.id
    assert user.roles == frozenset({Role.CLIENT})


def test_assign_roles_rejects_an_empty_list():
    with pytest.raises(RoleNotAllowed):
        a_user().assign_roles(frozenset(), assigned_by=uuid4())


def test_an_admin_cannot_remove_their_own_admin_role():
    admin = a_user(Role.ADMIN)

    with pytest.raises(OwnAccountProtected):
        admin.assign_roles(frozenset({Role.CLIENT}), assigned_by=admin.id)


def test_an_admin_can_add_roles_to_themselves_keeping_admin():
    admin = a_user(Role.ADMIN)

    changed = admin.assign_roles(frozenset({Role.ADMIN, Role.AGENT}), assigned_by=admin.id)

    assert changed.roles == frozenset({Role.ADMIN, Role.AGENT})


def test_an_admin_can_remove_the_admin_role_of_someone_else():
    other = a_user(Role.ADMIN)

    changed = other.assign_roles(frozenset({Role.CLIENT}), assigned_by=uuid4())

    assert changed.roles == frozenset({Role.CLIENT})


def test_deactivate_turns_the_account_off():
    user = a_user()

    changed = user.deactivate(deactivated_by=uuid4())

    assert changed.is_active is False
    assert user.is_active is True


def test_an_admin_cannot_deactivate_their_own_account():
    admin = a_user(Role.ADMIN)

    with pytest.raises(OwnAccountProtected):
        admin.deactivate(deactivated_by=admin.id)


def test_activate_turns_the_account_back_on():
    assert a_user(is_active=False).activate().is_active is True


@pytest.mark.parametrize("roles", [(Role.CLIENT,), (Role.AGENT,), (Role.CLIENT, Role.AGENT)])
def test_ensure_is_admin_rejects_other_roles(roles):
    with pytest.raises(AdminRequired):
        a_user(*roles).ensure_is_admin()


def test_ensure_is_admin_accepts_an_admin_with_more_roles():
    a_user(Role.ADMIN, Role.AGENT).ensure_is_admin()
