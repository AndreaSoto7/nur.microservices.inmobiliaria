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


def test_responde_204_sin_body(client, tokens):
    response = post(client, LOGOUT, tokens["refreshToken"])

    assert response.status_code == 204
    assert response.content == b""


def test_despues_de_cerrar_sesion_el_refresh_no_sirve(client, tokens):
    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, tokens["refreshToken"]).status_code == 401


def test_tambien_revoca_los_tokens_que_salieron_de_una_rotacion(client, tokens):
    rotated = post(client, REFRESH, tokens["refreshToken"]).json()["refreshToken"]

    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, rotated).status_code == 401


def test_es_idempotente(client, tokens):
    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, LOGOUT, tokens["refreshToken"]).status_code == 204


def test_no_cierra_otras_sesiones_del_mismo_usuario(client, tokens):
    other_session = login(client)

    post(client, LOGOUT, tokens["refreshToken"])

    assert post(client, REFRESH, other_session["refreshToken"]).status_code == 200


def test_un_token_invalido_responde_401(client):
    response = post(client, LOGOUT, "no-es-un-jwt")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_REFRESH_TOKEN"


def test_un_access_token_no_cierra_la_sesion(client, tokens):
    assert post(client, LOGOUT, tokens["accessToken"]).status_code == 401
    assert post(client, REFRESH, tokens["refreshToken"]).status_code == 200


@pytest.mark.parametrize("value", ["", 123])
def test_un_body_mal_formado_responde_400(client, value):
    assert post(client, LOGOUT, value).status_code == 400
