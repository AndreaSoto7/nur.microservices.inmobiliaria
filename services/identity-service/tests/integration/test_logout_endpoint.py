import pytest

pytestmark = pytest.mark.django_db

LOGOUT = "/api/v1/auth/logout"
REFRESH = "/api/v1/auth/refresh"
PASSWORD = "S3gura-2026"


def login(client) -> dict:
    return client.post(
        "/api/v1/auth/login",
        {"email": "ana@example.com", "password": PASSWORD},
        content_type="application/json",
    ).json()


@pytest.fixture
def tokens(client) -> dict:
    client.post(
        "/api/v1/auth/register",
        {"email": "ana@example.com", "password": PASSWORD, "fullName": "Ana"},
        content_type="application/json",
    )
    return login(client)


def post(client, url, token):
    return client.post(url, {"refreshToken": token}, content_type="application/json")


def test_responds_204_without_body(client, tokens):
    response = post(client, LOGOUT, tokens["refreshToken"])

    assert response.status_code == 204
    assert response.content == b""


def test_refresh_is_rejected_after_logout(client, tokens):
    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, tokens["refreshToken"]).status_code == 401


def test_also_revokes_tokens_issued_by_a_rotation(client, tokens):
    rotated = post(client, REFRESH, tokens["refreshToken"]).json()["refreshToken"]

    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, rotated).status_code == 401


def test_is_idempotent(client, tokens):
    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, LOGOUT, tokens["refreshToken"]).status_code == 204


def test_does_not_close_other_sessions_of_the_same_user(client, tokens):
    other_session = login(client)

    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, other_session["refreshToken"]).status_code == 200


def test_invalid_token_responds_401(client):
    response = post(client, LOGOUT, "no-es-un-jwt")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_REFRESH_TOKEN"


def test_access_token_does_not_close_the_session(client, tokens):
    assert post(client, LOGOUT, tokens["accessToken"]).status_code == 401
    assert post(client, REFRESH, tokens["refreshToken"]).status_code == 200


@pytest.mark.parametrize("value", ["", 123])
def test_malformed_body_responds_400(client, value):
    assert post(client, LOGOUT, value).status_code == 400
