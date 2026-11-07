import jwt
import pytest

from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db

LOGIN = "/api/v1/auth/login"
JWKS = "/api/v1/auth/.well-known/jwks.json"
PASSWORD = "S3gura-2026"


@pytest.fixture
def registered(client):
    response = client.post(
        "/api/v1/auth/register",
        {"email": "ana@example.com", "password": PASSWORD, "fullName": "Ana Pérez"},
        content_type="application/json",
    )
    return response.json()["id"]


def login(client, email="ana@example.com", password=PASSWORD):
    return client.post(
        LOGIN, {"email": email, "password": password}, content_type="application/json"
    )


def test_valid_login_responds_200_with_the_token_pair(client, registered):
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"accessToken", "refreshToken", "tokenType", "expiresIn"}
    assert body["tokenType"] == "Bearer"
    assert body["expiresIn"] == 900


def test_token_response_is_not_cached(client, registered):
    response = login(client)

    assert response["Cache-Control"] == "no-store"
    assert response["Pragma"] == "no-cache"


def test_email_is_case_insensitive(client, registered):
    assert login(client, email="ANA@Example.com").status_code == 200


def test_echoes_the_received_correlation_id(client, registered):
    response = client.post(
        LOGIN,
        {"email": "ana@example.com", "password": PASSWORD},
        content_type="application/json",
        headers={"X-Correlation-Id": "corr-login"},
    )

    assert response["X-Correlation-Id"] == "corr-login"


def test_access_token_validates_against_the_published_jwks(client, registered):
    token = login(client).json()["accessToken"]
    keys = client.get(JWKS).json()["keys"]
    kid = jwt.get_unverified_header(token)["kid"]
    key = next(jwt.PyJWK(k).key for k in keys if k["kid"] == kid)

    claims = jwt.decode(
        token, key, algorithms=["RS256"], audience="inmobiliaria", issuer="identity-service"
    )

    assert claims["sub"] == registered
    assert claims["roles"] == ["CLIENT"]


def test_wrong_password_responds_401_problem_json(client, registered):
    response = login(client, password="otra-clave")

    assert response.status_code == 401
    assert response["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "AUTH_INVALID_CREDENTIALS"
    assert body["title"] == "Credenciales inválidas"
    assert body["detail"] == "Email o contraseña incorrectos."


def _public_view(response) -> tuple:
    """Lo que ve el cliente, sin el correlationId (que cambia en cada request)."""
    body = response.json()
    body.pop("correlationId")
    headers = {k: v for k, v in response.headers.items() if k != "X-Correlation-Id"}
    return response.status_code, headers, body


def test_unknown_email_responds_exactly_the_same(client, registered):
    wrong_password = login(client, password="otra-clave")
    unknown_email = login(client, email="nadie@example.com")

    assert _public_view(unknown_email) == _public_view(wrong_password)


def test_inactive_user_responds_exactly_the_same(client, registered):
    wrong_password = login(client, password="otra-clave")
    UserModel.objects.filter(email="ana@example.com").update(is_active=False)

    assert _public_view(login(client)) == _public_view(wrong_password)


def test_missing_fields_respond_400(client):
    response = client.post(LOGIN, {"email": "ana@example.com"}, content_type="application/json")

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_malformed_email_responds_400(client):
    response = login(client, email="no-es-un-email")

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_jwks_is_public_cacheable_and_only_has_the_public_part(client):
    response = client.get(JWKS)

    assert response.status_code == 200
    assert response["Cache-Control"] == "public, max-age=300"
    (key,) = response.json()["keys"]
    assert set(key) == {"kty", "use", "alg", "kid", "n", "e"}


def test_non_string_password_responds_400(client, registered):
    response = login(client, password=12345678)

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_user_with_corrupt_data_responds_500_and_reveals_nothing(registered):
    from django.test import Client

    UserModel.objects.filter(email="ana@example.com").update(roles=[])

    response = Client(raise_request_exception=False).post(
        LOGIN,
        {"email": "ana@example.com", "password": PASSWORD},
        content_type="application/json",
    )

    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "rol" not in response.content.decode().lower()
    assert "ana@example.com" not in response.content.decode()


@pytest.mark.parametrize("password", [PASSWORD, "otra-clave"])
def test_corrupt_name_responds_500_and_does_not_reveal_the_account_exists(registered, password):
    from django.test import Client

    UserModel.objects.filter(email="ana@example.com").update(full_name="")

    response = Client(raise_request_exception=False).post(
        LOGIN,
        {"email": "ana@example.com", "password": password},
        content_type="application/json",
    )

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"


def test_login_updates_an_outdated_hash_without_changing_the_password(client, registered, settings):
    old = UserModel.objects.get(email="ana@example.com").password
    settings.PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.PBKDF2PasswordHasher",
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]

    assert login(client).status_code == 200

    updated = UserModel.objects.get(email="ana@example.com")
    assert updated.password != old
    assert updated.password.startswith("pbkdf2_sha256$")
    assert login(client).status_code == 200
    assert login(client, password="otra-clave").status_code == 401
