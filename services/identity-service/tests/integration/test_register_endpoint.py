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


def test_registra_y_responde_201_con_el_id(client):
    response = post(client, a_body())

    assert response.status_code == 201
    saved = UserModel.objects.get(id=uuid.UUID(response.json()["id"]))
    assert saved.email == "ana@example.com"
    assert saved.full_name == "Ana Pérez"
    assert saved.roles == ["CLIENT"]


def test_registra_un_agente(client):
    response = post(client, a_body(role="AGENT"))

    assert response.status_code == 201
    assert UserModel.objects.get(email="ana@example.com").roles == ["AGENT"]


def test_guarda_la_contrasena_hasheada(client):
    post(client, a_body())

    saved = UserModel.objects.get(email="ana@example.com")
    assert saved.password != "S3gura-2026"
    assert saved.check_password("S3gura-2026")


def test_la_respuesta_no_incluye_la_contrasena(client):
    assert "password" not in post(client, a_body()).json()


def test_email_repetido_responde_409_sin_revelar_el_email(client):
    post(client, a_body())

    response = post(client, a_body(email="ANA@example.com"))

    assert response.status_code == 409
    assert response["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "USER_EMAIL_ALREADY_REGISTERED"
    assert body["detail"] == "Ya existe un usuario con ese email."


def test_campos_faltantes_responden_400_problem_json_con_nombres_en_camel_case(client):
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
def test_contrasena_fuera_de_rango_responde_siempre_user_weak_password(client, password):
    response = post(client, a_body(password=password))

    assert response.status_code == 400
    assert response.json()["code"] == "USER_WEAK_PASSWORD"


@pytest.mark.parametrize("role", ["ADMIN", "FOO"])
def test_rol_no_permitido_responde_400_user_role_not_allowed(client, role):
    response = post(client, a_body(role=role))

    assert response.status_code == 400
    assert response.json()["code"] == "USER_ROLE_NOT_ALLOWED"
    assert not UserModel.objects.exists()


def test_json_malformado_responde_validation_error_sin_detalles_del_parser(client):
    response = client.post(URL, "{email: ", content_type="application/json")

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["detail"] == "El cuerpo de la petición no es JSON válido."


def test_metodo_no_permitido_tiene_titulo_legible(client):
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


def test_el_log_de_django_request_lleva_el_correlation_id(client):
    capture = _Capture()
    logger = logging.getLogger("django.request")
    logger.addHandler(capture)
    try:
        post(client, {}, **{"X-Correlation-Id": "corr-log"})
    finally:
        logger.removeHandler(capture)

    assert [record.correlation_id for record in capture.records] == ["corr-log"]


@pytest.mark.parametrize("override", [{"password": 12345678}, {"fullName": 123}, {"role": 1}])
def test_los_valores_que_no_son_string_responden_400(client, override):
    response = post(client, a_body(**override))

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert not UserModel.objects.exists()
