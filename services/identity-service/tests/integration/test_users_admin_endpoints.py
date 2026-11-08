from uuid import UUID, uuid4

import pytest
from django.core.management import call_command

from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db

USERS = "/api/v1/users"
PASSWORD = "S3gura-2026"


def login(client, email: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        {"email": email, "password": PASSWORD},
        content_type="application/json",
    )
    assert response.status_code == 200
    return response.json()["accessToken"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin(db) -> UserModel:
    return UserModel.objects.create_superuser("admin@example.com", PASSWORD, full_name="Admin")


@pytest.fixture
def ana(db) -> UserModel:
    return UserModel.objects.create_user("ana@example.com", PASSWORD, full_name="Ana Pérez")


@pytest.fixture
def admin_token(client, admin) -> str:
    return login(client, admin.email)


def put_roles(client, token: str, user_id: UUID, roles) -> object:
    return client.put(
        f"{USERS}/{user_id}/roles",
        {"roles": roles},
        content_type="application/json",
        headers=bearer(token),
    )


def assert_problem(response, status: int, code: str) -> None:
    assert response.status_code == status
    assert response["Content-Type"] == "application/problem+json"
    assert response.json()["code"] == code


def test_an_admin_lists_users_in_the_contract_format(client, admin_token, ana):
    response = client.get(USERS, headers=bearer(admin_token))

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == {"number": 1, "size": 20, "totalElements": 2, "totalPages": 1}
    item = next(user for user in body["data"] if user["email"] == "ana@example.com")
    assert set(item) == {"id", "email", "fullName", "roles", "active", "registeredAt"}
    assert item["id"] == str(ana.id)
    assert item["fullName"] == "Ana Pérez"
    assert item["roles"] == ["CLIENT"]
    assert item["active"] is True


def test_the_list_never_includes_the_password(client, admin_token, ana):
    response = client.get(USERS, headers=bearer(admin_token))

    assert ana.password not in response.content.decode()
    assert "password" not in response.content.decode()


def test_the_list_shows_the_newest_first_and_filters_by_role(client, admin_token, ana):
    all_users = client.get(USERS, headers=bearer(admin_token)).json()["data"]
    admins = client.get(f"{USERS}?role=ADMIN", headers=bearer(admin_token)).json()["data"]

    assert [user["email"] for user in all_users] == ["ana@example.com", "admin@example.com"]
    assert [user["email"] for user in admins] == ["admin@example.com"]


def test_the_list_filter_finds_a_role_in_any_position(client, admin_token, ana):
    UserModel.objects.filter(id=ana.id).update(roles=["CLIENT", "AGENT"])

    agents = client.get(f"{USERS}?role=AGENT", headers=bearer(admin_token)).json()["data"]

    assert [user["email"] for user in agents] == ["ana@example.com"]


@pytest.mark.parametrize("query", ["page=0", "size=0", "size=101", "page=x", "role=ROOT"])
def test_the_list_rejects_invalid_parameters(client, admin_token, query):
    assert_problem(
        client.get(f"{USERS}?{query}", headers=bearer(admin_token)), 400, "VALIDATION_ERROR"
    )


def test_the_list_paginates(client, admin_token, ana):
    response = client.get(f"{USERS}?size=1&page=2", headers=bearer(admin_token))

    assert [user["email"] for user in response.json()["data"]] == ["admin@example.com"]
    assert response.json()["page"]["totalPages"] == 2


def test_an_admin_changes_the_roles_of_a_user(client, admin_token, ana):
    response = put_roles(client, admin_token, ana.id, ["AGENT", "CLIENT"])

    assert response.status_code == 204
    ana.refresh_from_db()
    assert sorted(ana.roles) == ["AGENT", "CLIENT"]


def test_new_roles_reach_the_next_login(client, admin_token, ana):
    put_roles(client, admin_token, ana.id, ["AGENT"])

    me = client.get(f"{USERS}/me", headers=bearer(login(client, ana.email)))

    assert me.json()["roles"] == ["AGENT"]


@pytest.mark.parametrize(
    "roles", [[], ["ROOT"], ["CLIENT", "CLIENT"], "CLIENT", None, [1]], ids=str
)
def test_invalid_roles_are_rejected(client, admin_token, ana, roles):
    assert_problem(put_roles(client, admin_token, ana.id, roles), 400, "VALIDATION_ERROR")
    ana.refresh_from_db()
    assert ana.roles == ["CLIENT"]


def test_unknown_fields_are_rejected(client, admin_token, ana):
    response = client.put(
        f"{USERS}/{ana.id}/roles",
        {"roles": ["AGENT"], "isActive": False},
        content_type="application/json",
        headers=bearer(admin_token),
    )

    assert_problem(response, 400, "VALIDATION_ERROR")


def test_an_admin_cannot_remove_their_own_admin_role(client, admin, admin_token):
    assert_problem(
        put_roles(client, admin_token, admin.id, ["CLIENT"]),
        409,
        "USER_OWN_ACCOUNT_PROTECTED",
    )
    admin.refresh_from_db()
    assert admin.roles == ["ADMIN"]


def test_a_deactivated_user_cannot_log_in_until_activated(client, admin_token, ana):
    token = bearer(admin_token)

    assert client.post(f"{USERS}/{ana.id}/deactivate", headers=token).status_code == 204
    denied = client.post(
        "/api/v1/auth/login",
        {"email": ana.email, "password": PASSWORD},
        content_type="application/json",
    )
    assert_problem(denied, 401, "AUTH_INVALID_CREDENTIALS")

    assert client.post(f"{USERS}/{ana.id}/activate", headers=token).status_code == 204
    assert login(client, ana.email)


def test_a_deactivated_user_cannot_renew_their_session(client, admin_token, ana):
    tokens = client.post(
        "/api/v1/auth/login",
        {"email": ana.email, "password": PASSWORD},
        content_type="application/json",
    ).json()

    client.post(f"{USERS}/{ana.id}/deactivate", headers=bearer(admin_token))
    refresh = client.post(
        "/api/v1/auth/refresh",
        {"refreshToken": tokens["refreshToken"]},
        content_type="application/json",
    )

    assert_problem(refresh, 401, "AUTH_INVALID_REFRESH_TOKEN")


def test_an_admin_cannot_deactivate_their_own_account(client, admin, admin_token):
    assert_problem(
        client.post(f"{USERS}/{admin.id}/deactivate", headers=bearer(admin_token)),
        409,
        "USER_OWN_ACCOUNT_PROTECTED",
    )


@pytest.mark.parametrize(
    ("method", "suffix", "body"),
    [
        ("put", "/roles", {"roles": ["AGENT"]}),
        ("post", "/deactivate", None),
        ("post", "/activate", None),
    ],
)
class TestChangesByRoute:
    def call(self, client, token, user_id, method, suffix, body):
        kwargs = {"content_type": "application/json", "data": body} if body else {}
        headers = bearer(token) if token else {}
        return getattr(client, method)(f"{USERS}/{user_id}{suffix}", headers=headers, **kwargs)

    def test_a_client_is_forbidden(self, client, ana, admin, method, suffix, body):
        token = login(client, ana.email)

        response = self.call(client, token, admin.id, method, suffix, body)

        assert_problem(response, 403, "USER_ADMIN_REQUIRED")
        admin.refresh_from_db()
        assert admin.is_active is True
        assert admin.roles == ["ADMIN"]

    def test_no_token_is_unauthorized(self, client, ana, method, suffix, body):
        assert_problem(
            self.call(client, None, ana.id, method, suffix, body), 401, "AUTH_INVALID_TOKEN"
        )

    def test_an_unknown_user_is_not_found(self, client, admin_token, method, suffix, body):
        response = self.call(client, admin_token, uuid4(), method, suffix, body)

        assert_problem(response, 404, "USER_NOT_FOUND")

    def test_an_id_that_is_not_a_uuid_is_not_found(self, client, admin_token, method, suffix, body):
        response = self.call(client, admin_token, "no-es-uuid", method, suffix, body)

        assert_problem(response, 404, "NOT_FOUND")


def test_a_client_cannot_list_users(client, ana):
    assert_problem(
        client.get(USERS, headers=bearer(login(client, ana.email))), 403, "USER_ADMIN_REQUIRED"
    )


def test_a_demoted_admin_loses_access_with_the_token_they_still_hold(client, admin, admin_token):
    UserModel.objects.filter(id=admin.id).update(roles=["CLIENT"])

    assert_problem(client.get(USERS, headers=bearer(admin_token)), 403, "USER_ADMIN_REQUIRED")


def test_a_deactivated_admin_loses_access_with_the_token_they_still_hold(
    client, admin, admin_token
):
    UserModel.objects.filter(id=admin.id).update(is_active=False)

    assert_problem(client.get(USERS, headers=bearer(admin_token)), 401, "AUTH_INVALID_TOKEN")


def test_public_registration_still_cannot_create_an_admin(client):
    response = client.post(
        "/api/v1/auth/register",
        {"email": "x@example.com", "password": PASSWORD, "fullName": "X", "role": "ADMIN"},
        content_type="application/json",
    )

    assert_problem(response, 400, "USER_ROLE_NOT_ALLOWED")


def test_the_first_admin_is_created_with_the_django_command(client, monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", PASSWORD)

    call_command(
        "createsuperuser", interactive=False, email="root@example.com", full_name="Root Admin"
    )

    token = login(client, "root@example.com")
    assert client.get(USERS, headers=bearer(token)).status_code == 200
