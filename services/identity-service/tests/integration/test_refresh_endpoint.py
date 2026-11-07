import jwt
import pytest
from django.test import Client

from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db

REFRESH = "/api/v1/auth/refresh"
PASSWORD = "S3gura-2026"


@pytest.fixture
def tokens(client) -> dict:
    client.post(
        "/api/v1/auth/register",
        {"email": "ana@example.com", "password": PASSWORD, "fullName": "Ana"},
        content_type="application/json",
    )
    response = client.post(
        "/api/v1/auth/login",
        {"email": "ana@example.com", "password": PASSWORD},
        content_type="application/json",
    )
    return response.json()


def refresh(client: Client, token):
    return client.post(REFRESH, {"refreshToken": token}, content_type="application/json")


def test_returns_a_new_pair_without_caching(client, tokens):
    response = refresh(client, tokens["refreshToken"])

    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert response["Pragma"] == "no-cache"
    body = response.json()
    assert set(body) == {"accessToken", "refreshToken", "tokenType", "expiresIn"}
    assert body["refreshToken"] != tokens["refreshToken"]


def test_new_pair_belongs_to_the_same_family(client, tokens):
    body = refresh(client, tokens["refreshToken"]).json()

    def fid(token: str) -> str:
        return jwt.decode(token, options={"verify_signature": False})["fid"]

    assert fid(body["refreshToken"]) == fid(tokens["refreshToken"])


def test_reusing_a_token_responds_401_and_revokes_the_new_one(client, tokens):
    newer = refresh(client, tokens["refreshToken"]).json()["refreshToken"]

    reused = refresh(client, tokens["refreshToken"])

    assert reused.status_code == 401
    assert reused["Content-Type"] == "application/problem+json"
    assert reused.json()["code"] == "AUTH_INVALID_REFRESH_TOKEN"
    assert refresh(client, newer).status_code == 401


def test_access_token_is_not_accepted_as_refresh(client, tokens):
    assert refresh(client, tokens["accessToken"]).status_code == 401


def test_invalid_token_responds_the_same_as_a_reused_one(client, tokens):
    refresh(client, tokens["refreshToken"])
    reused = refresh(client, tokens["refreshToken"]).json()
    invalid = refresh(client, "no-es-un-jwt").json()

    for body in (reused, invalid):
        body.pop("correlationId")
    assert invalid == reused


def test_inactive_user_responds_401(client, tokens):
    UserModel.objects.filter(email="ana@example.com").update(is_active=False)

    assert refresh(client, tokens["refreshToken"]).status_code == 401


@pytest.mark.parametrize("value", ["", 123, None, "x" * 4097])
def test_malformed_body_responds_400(client, value):
    response = refresh(client, value)

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_without_the_field_responds_400(client):
    response = client.post(REFRESH, {}, content_type="application/json")

    assert response.status_code == 400
