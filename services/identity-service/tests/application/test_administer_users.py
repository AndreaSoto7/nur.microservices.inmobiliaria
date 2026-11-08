from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from identity.application.commands.administer_users import (
    ActivateUserCommand,
    ActivateUserHandler,
    AssignUserRolesCommand,
    AssignUserRolesHandler,
    DeactivateUserCommand,
    DeactivateUserHandler,
)
from identity.application.dto import UserDirectoryPage
from identity.application.queries.list_users import ListUsersHandler, ListUsersQuery
from identity.domain.email import Email
from identity.domain.errors import (
    AdminRequired,
    InvalidAccessToken,
    OwnAccountProtected,
    RoleNotAllowed,
    UserNotFound,
)
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from tests.application.fakes import InMemoryUserRepository

NOW = datetime(2026, 11, 3, tzinfo=UTC)


def add_user(users, email: str, *roles: Role, is_active: bool = True) -> User:
    user = User(
        id=uuid4(),
        email=Email(email),
        full_name=FullName("Nombre Apellido"),
        password_hash="hash-de-prueba",
        roles=frozenset(roles),
        is_active=is_active,
        registered_at=NOW,
    )
    users.users[email] = user
    return user


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def admin(users) -> User:
    return add_user(users, "admin@example.com", Role.ADMIN)


@pytest.fixture
def client(users) -> User:
    return add_user(users, "ana@example.com", Role.CLIENT)


def current(users, user: User) -> User:
    return users.get_by_id(user.id)


def assign(users, actor_id: UUID, user_id: UUID, *roles: str) -> None:
    AssignUserRolesHandler(users=users).handle(
        AssignUserRolesCommand(actor_id=actor_id, user_id=user_id, roles=roles)
    )


def deactivate(users, actor_id: UUID, user_id: UUID) -> None:
    DeactivateUserHandler(users=users).handle(
        DeactivateUserCommand(actor_id=actor_id, user_id=user_id)
    )


def activate(users, actor_id: UUID, user_id: UUID) -> None:
    ActivateUserHandler(users=users).handle(ActivateUserCommand(actor_id=actor_id, user_id=user_id))


def list_users(users, actor_id: UUID, **filters) -> UserDirectoryPage:
    return ListUsersHandler(users=users, directory=users).handle(
        ListUsersQuery(actor_id=actor_id, **{"page": 1, "size": 20, **filters})
    )


def test_an_admin_replaces_the_roles_of_a_user(users, admin, client):
    assign(users, admin.id, client.id, "AGENT", "CLIENT")

    assert current(users, client).roles == frozenset({Role.AGENT, Role.CLIENT})


def test_assigning_the_same_roles_twice_leaves_the_same_result(users, admin, client):
    assign(users, admin.id, client.id, "AGENT")
    assign(users, admin.id, client.id, "AGENT")

    assert current(users, client).roles == frozenset({Role.AGENT})


def test_assigning_roles_keeps_the_account_status(users, admin):
    inactive = add_user(users, "off@example.com", Role.CLIENT, is_active=False)

    assign(users, admin.id, inactive.id, "AGENT")

    assert current(users, inactive).is_active is False


def test_an_unknown_role_is_rejected(users, admin, client):
    with pytest.raises(RoleNotAllowed):
        assign(users, admin.id, client.id, "ROOT")

    assert current(users, client).roles == frozenset({Role.CLIENT})


def test_an_admin_cannot_remove_their_own_role_through_the_command(users, admin):
    with pytest.raises(OwnAccountProtected):
        assign(users, admin.id, admin.id, "CLIENT")

    assert current(users, admin).roles == frozenset({Role.ADMIN})


def test_an_admin_deactivates_and_activates_a_user(users, admin, client):
    deactivate(users, admin.id, client.id)
    assert current(users, client).is_active is False

    activate(users, admin.id, client.id)
    assert current(users, client).is_active is True


def test_deactivating_twice_is_harmless(users, admin, client):
    deactivate(users, admin.id, client.id)
    deactivate(users, admin.id, client.id)

    assert current(users, client).is_active is False


def test_an_admin_cannot_deactivate_themselves_through_the_command(users, admin):
    with pytest.raises(OwnAccountProtected):
        deactivate(users, admin.id, admin.id)

    assert current(users, admin).is_active is True


@pytest.mark.parametrize(
    "run",
    [
        lambda users, actor, target: assign(users, actor, target, "ADMIN"),
        deactivate,
        activate,
        lambda users, actor, _target: list_users(users, actor),
    ],
    ids=["assign", "deactivate", "activate", "list"],
)
class TestAuthorization:
    def test_a_user_without_the_admin_role_is_rejected(self, users, client, run):
        other = add_user(users, "otro@example.com", Role.AGENT)

        with pytest.raises(AdminRequired):
            run(users, client.id, other.id)

        assert current(users, other).roles == frozenset({Role.AGENT})
        assert current(users, other).is_active is True

    def test_a_demoted_admin_is_rejected_even_with_a_valid_token(self, users, admin, client, run):
        # El token dice ADMIN hasta que venza; lo que manda es lo que dice la base ahora.
        users.users[admin.email.value] = admin.assign_roles(
            frozenset({Role.CLIENT}), assigned_by=uuid4()
        )

        with pytest.raises(AdminRequired):
            run(users, admin.id, client.id)

    def test_a_deactivated_admin_is_rejected(self, users, admin, client, run):
        users.users[admin.email.value] = admin.deactivate(deactivated_by=uuid4())

        with pytest.raises(InvalidAccessToken):
            run(users, admin.id, client.id)

    def test_an_actor_that_no_longer_exists_is_rejected(self, users, client, run):
        with pytest.raises(InvalidAccessToken):
            run(users, uuid4(), client.id)


@pytest.mark.parametrize(
    "run",
    [
        lambda users, actor, target: assign(users, actor, target, "AGENT"),
        deactivate,
        activate,
    ],
    ids=["assign", "deactivate", "activate"],
)
def test_changing_a_user_that_does_not_exist_is_rejected(users, admin, run):
    with pytest.raises(UserNotFound):
        run(users, admin.id, uuid4())


def test_the_list_shows_what_an_admin_needs_without_the_password(users, admin, client):
    page = list_users(users, admin.id)

    assert page.total_elements == 2
    assert page.total_pages == 1
    item = next(user for user in page.data if user.id == client.id)
    assert item.email == "ana@example.com"
    assert item.full_name == "Nombre Apellido"
    assert item.roles == ["CLIENT"]
    assert item.active is True
    assert item.registered_at == NOW
    assert not hasattr(item, "password_hash")


def test_the_list_filters_by_role(users, admin, client):
    page = list_users(users, admin.id, role=Role.ADMIN)

    assert [user.id for user in page.data] == [admin.id]
    assert page.total_elements == 1


def test_the_list_is_paginated(users, admin, client):
    add_user(users, "tercero@example.com", Role.AGENT)

    page = list_users(users, admin.id, size=2, page=2)

    assert len(page.data) == 1
    assert (page.number, page.size, page.total_elements, page.total_pages) == (2, 2, 3, 2)
