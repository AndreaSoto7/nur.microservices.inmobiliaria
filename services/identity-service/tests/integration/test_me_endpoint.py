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


def test_devuelve_los_datos_del_usuario_autenticado(client, tokens):
    response = get_me(client, tokens["accessToken"])

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "email", "fullName", "roles", "registeredAt"}
    assert body["email"] == "ana@example.com"
    assert body["fullName"] == "Ana Pérez"
    assert body["roles"] == ["AGENT"]
    assert body["registeredAt"].endswith("Z")


def test_sin_token_responde_401(client):
    assert_invalid_token(get_me(client))


def test_un_refresh_token_no_sirve_como_access_token(client, tokens):
    assert_invalid_token(get_me(client, tokens["refreshToken"]))


def test_un_token_que_no_es_jwt_responde_401(client):
    assert_invalid_token(get_me(client, "no-es-un-jwt"))


def test_otro_esquema_de_autenticacion_responde_401(client, tokens):
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
def test_un_token_bien_firmado_con_claims_incorrectos_responde_401(client, tokens, overrides):
    assert_invalid_token(get_me(client, a_token(tokens, **overrides)))


def test_un_token_sin_exp_responde_401(client, tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})
    del claims["exp"]
    token = jwt.encode(
        claims,
        container.signing_key().private_key,
        algorithm="RS256",
        headers={"typ": "at+jwt"},
    )

    assert_invalid_token(get_me(client, token))


def test_un_token_sin_firma_alg_none_responde_401(client, tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})
    token = jwt.encode(claims, None, algorithm="none", headers={"typ": "at+jwt"})

    assert_invalid_token(get_me(client, token))


def test_un_usuario_inactivo_responde_401(client, tokens):
    UserModel.objects.filter(email="ana@example.com").update(is_active=False)

    assert_invalid_token(get_me(client, tokens["accessToken"]))


def test_el_ttl_del_access_token_sigue_siendo_de_15_minutos(tokens):
    claims = jwt.decode(tokens["accessToken"], options={"verify_signature": False})

    assert timedelta(seconds=claims["exp"] - claims["iat"]) == timedelta(minutes=15)
