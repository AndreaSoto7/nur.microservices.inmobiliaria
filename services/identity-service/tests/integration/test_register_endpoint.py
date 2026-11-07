import logging
import uuid

import pytest

from identity.infrastructure.observability import CorrelationIdFilter
from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db

URL = "/api/v1/auth/register"


def a_body(**overrides) -> dict:
    return {
        "email": "ana@example.com",
        "password": "S3gura-2026",
        "fullName": "Ana Pérez",
    } | overrides


def post(client, body, **headers):
    return client.post(URL, body, content_type="application/json", headers=headers)


def test_registers_and_responds_201_with_the_id(client):
    response = post(client, a_body())

    assert response.status_code == 201
    saved = UserModel.objects.get(id=uuid.UUID(response.json()["id"]))
    assert saved.email == "ana@example.com"
    assert saved.full_name == "Ana Pérez"
    assert saved.roles == ["CLIENT"]


def test_registers_an_agent(client):
    response = post(client, a_body(role="AGENT"))

    assert response.status_code == 201
    assert UserModel.objects.get(email="ana@example.com").roles == ["AGENT"]


def test_stores_the_hashed_password(client):
    post(client, a_body())

    saved = UserModel.objects.get(email="ana@example.com")
    assert saved.password != "S3gura-2026"
    assert saved.check_password("S3gura-2026")


def test_response_does_not_include_the_password(client):
    assert "password" not in post(client, a_body()).json()


def test_duplicate_email_responds_409_without_revealing_the_email(client):
    post(client, a_body())

    response = post(client, a_body(email="ANA@example.com"))

    assert response.status_code == 409
    assert response["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "USER_EMAIL_ALREADY_REGISTERED"
    assert body["detail"] == "Ya existe un usuario con ese email."


def test_missing_fields_respond_400_problem_json_with_camel_case_names(client):
    response = post(client, {"email": "ana@example.com"}, **{"X-Correlation-Id": "corr-1"})

    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    assert response["X-Correlation-Id"] == "corr-1"
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["type"] == "https://inmobiliaria.local/problems/validation-error"
    assert body["instance"] == URL
    assert body["correlationId"] == "corr-1"
    assert {error["field"] for error in body["errors"]} == {"password", "fullName"}


@pytest.mark.parametrize("password", ["corta", "x" * 200, "x" * 2000])
def test_out_of_range_password_always_responds_user_weak_password(client, password):
    response = post(client, a_body(password=password))

    assert response.status_code == 400
    assert response.json()["code"] == "USER_WEAK_PASSWORD"


@pytest.mark.parametrize("role", ["ADMIN", "FOO"])
def test_disallowed_role_responds_400_user_role_not_allowed(client, role):
    response = post(client, a_body(role=role))

    assert response.status_code == 400
    assert response.json()["code"] == "USER_ROLE_NOT_ALLOWED"
    assert not UserModel.objects.exists()


def test_malformed_json_responds_validation_error_without_parser_details(client):
    response = client.post(URL, "{email: ", content_type="application/json")

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["detail"] == "El cuerpo de la petición no es JSON válido."


def test_method_not_allowed_has_a_readable_title(client):
    response = client.get(URL)

    assert response.status_code == 405
    assert response.json()["title"] == "Método no permitido"


class _Capture(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []
        self.addFilter(CorrelationIdFilter())

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def test_django_request_log_carries_the_correlation_id(client):
    capture = _Capture()
    logger = logging.getLogger("django.request")
    logger.addHandler(capture)
    try:
        post(client, {}, **{"X-Correlation-Id": "corr-log"})
    finally:
        logger.removeHandler(capture)

    assert [record.correlation_id for record in capture.records] == ["corr-log"]


@pytest.mark.parametrize("override", [{"password": 12345678}, {"fullName": 123}, {"role": 1}])
def test_non_string_values_respond_400(client, override):
    response = post(client, a_body(**override))

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert not UserModel.objects.exists()
