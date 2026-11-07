from datetime import timedelta

import jwt
import pytest

from identity import container
from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db

ME = "/api/v1/users/me"
PASSWORD = "S3gura-2026"


@pytest.fixture
def tokens(client) -> dict:
    client.post(
        "/api/v1/auth/register",
        {
            "email": "ana@example.com",
            "password": PASSWORD,
            "fullName": "Ana Pérez",
            "role": "AGENT",
        },
        content_type="application/json",
    )
    return client.post(
        "/api/v1/auth/login",
        {"email": "ana@example.com", "password": PASSWORD},
        content_type="application/json",
    ).json()


def get_me(client, token=None, scheme="Bearer"):
    headers = {"Authorization": f"{scheme} {token}"} if token else {}
    return client.get(ME, headers=headers)


def assert_invalid_token(response) -> None:
    assert response.status_code == 401
    assert response["Content-Type"] == "application/problem+json"
    assert response["WWW-Authenticate"] == "Bearer"
    assert response.json()["code"] == "AUTH_INVALID_TOKEN"


def test_returns_the_authenticated_user_data(client, tokens):
    response = get_me(client, tokens["accessToken"])

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "email", "fullName", "roles", "registeredAt"}
    assert body["email"] == "ana@example.com"
    assert body["fullName"] == "Ana Pérez"
    assert body["roles"] == ["AGENT"]
    assert body["registeredAt"].endswith("Z")


def test_without_token_responds_401(client):
    assert_invalid_token(get_me(client))


def test_refresh_token_is_not_accepted_as_access_token(client, tokens):
    assert_invalid_token(get_me(client, tokens["refreshToken"]))


def test_non_jwt_token_responds_401(client):
    assert_invalid_token(get_me(client, "no-es-un-jwt"))


def test_other_authentication_scheme_responds_401(client, tokens):
    assert_invalid_token(get_me(client, tokens["accessToken"], scheme="Basic"))


def a_token(tokens: dict, **overrides) -> str:
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False}) | overrides
    return jwt.encode(
        claims,
        container.signing_key().private_key,
        algorithm="RS256",
        headers={"typ": "at+jwt", "kid": container.signing_key().kid},
    )


@pytest.mark.parametrize(
    "overrides",
    [{"aud": "otro"}, {"iss": "otro"}, {"exp": 1_000_000}, {"sub": "no-uuid"}],
)
def test_properly_signed_token_with_wrong_claims_responds_401(client, tokens, overrides):
    assert_invalid_token(get_me(client, a_token(tokens, **overrides)))


def test_token_without_exp_responds_401(client, tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})
    del claims["exp"]
    token = jwt.encode(
        claims,
        container.signing_key().private_key,
        algorithm="RS256",
        headers={"typ": "at+jwt"},
    )

    assert_invalid_token(get_me(client, token))


def test_unsigned_alg_none_token_responds_401(client, tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})
    token = jwt.encode(claims, None, algorithm="none", headers={"typ": "at+jwt"})

    assert_invalid_token(get_me(client, token))


def test_inactive_user_responds_401(client, tokens):
    UserModel.objects.filter(email="ana@example.com").update(is_active=False)

    assert_invalid_token(get_me(client, tokens["accessToken"]))


def test_access_token_ttl_is_still_15_minutes(tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})

    assert timedelta(seconds=claims["exp"] - claims["iat"]) == timedelta(minutes=15)
