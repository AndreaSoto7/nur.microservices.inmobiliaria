import json

import pytest
from django.core.exceptions import PermissionDenied
from django.db import InterfaceError, OperationalError
from django.urls import get_resolver

from identity import container
from identity.infrastructure.persistence import health


def test_liveness_no_toca_la_base(client):
    # Sin la marca django_db, pytest-django falla si alguien accede a la base aquí.
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


@pytest.mark.django_db
def test_readiness_responde_up_con_la_base_disponible(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_devuelve_el_correlation_id_recibido(client):
    response = client.get("/health", headers={"X-Correlation-Id": "abc-123"})

    assert response["X-Correlation-Id"] == "abc-123"


def test_genera_un_correlation_id_si_no_llega_o_es_invalido(client):
    response = client.get("/health", headers={"X-Correlation-Id": "malo\ninyectado"})

    assert response["X-Correlation-Id"] not in ("", "malo\ninyectado")
    assert len(response["X-Correlation-Id"]) == 36


def test_ruta_inexistente_responde_problem_json(client):
    response = client.get("/api/v1/no-existe", headers={"X-Correlation-Id": "c-1"})

    assert response.status_code == 404
    assert response["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["correlationId"] == "c-1"
    assert body["instance"] == "/api/v1/no-existe"


@pytest.mark.parametrize("error", [OperationalError, InterfaceError])
def test_readiness_responde_down_si_la_base_falla(client, monkeypatch, error):
    def broken() -> None:
        raise error("la base no responde")

    monkeypatch.setattr(container, "check_database", broken)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN"}


@pytest.mark.django_db
def test_readiness_responde_down_si_falta_la_clave_de_firma(client, settings):
    settings.JWT_PRIVATE_KEY = ""
    settings.JWT_PRIVATE_KEY_PATH = ""
    container.signing_key.cache_clear()
    try:
        response = client.get("/health/ready")
    finally:
        container.signing_key.cache_clear()

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN"}


def test_el_handler_403_responde_problem_json(rf):
    handler, _ = get_resolver().resolve_error_handler(403), None

    response = handler(rf.get("/x"), exception=PermissionDenied())

    assert response.status_code == 403
    assert response["Content-Type"] == "application/problem+json"
    assert json.loads(response.content)["code"] == "PERMISSION_DENIED"


def test_check_database_hace_una_consulta_real(monkeypatch):
    executed: list[str] = []

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, sql):
            executed.append(sql)

    monkeypatch.setattr(health.connection, "cursor", Cursor)

    health.check_database()

    assert executed == ["SELECT 1"]


def test_docs_responde_swagger_ui(client):
    assert client.get("/docs").status_code == 200


def test_host_no_permitido_responde_problem_json_y_no_html(client):
    response = client.get("/health", headers={"host": "evil.example"})

    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    assert response.json()["code"] == "BAD_REQUEST"


def test_error_inesperado_responde_500_problem_json_sin_detalles(monkeypatch):
    from django.test import Client

    def broken():
        raise RuntimeError("secreto interno")

    monkeypatch.setattr(container, "register_user_handler", broken)

    response = Client(raise_request_exception=False).post(
        "/api/v1/auth/register",
        {"email": "ana@example.com", "password": "S3gura-2026", "fullName": "Ana"},
        content_type="application/json",
    )

    assert response.status_code == 500
    assert response["Content-Type"] == "application/problem+json"
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "secreto" not in response.content.decode()
