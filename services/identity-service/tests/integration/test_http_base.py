import json

import pytest
from django.core.exceptions import PermissionDenied
from django.db import InterfaceError, OperationalError
from django.urls import get_resolver

from identity import container
from identity.infrastructure.persistence import health


def test_liveness_does_not_touch_the_database(client):
    # Sin la marca django_db, pytest-django falla si alguien accede a la base aquí.
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


@pytest.mark.django_db
def test_readiness_responds_up_with_the_database_available(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_echoes_the_received_correlation_id(client):
    response = client.get("/health", headers={"X-Correlation-Id": "abc-123"})

    assert response["X-Correlation-Id"] == "abc-123"


def test_generates_a_correlation_id_when_missing_or_invalid(client):
    response = client.get("/health", headers={"X-Correlation-Id": "malo\ninyectado"})

    assert response["X-Correlation-Id"] not in ("", "malo\ninyectado")
    assert len(response["X-Correlation-Id"]) == 36


def test_unknown_route_responds_problem_json(client):
    response = client.get("/api/v1/no-existe", headers={"X-Correlation-Id": "c-1"})

    assert response.status_code == 404
    assert response["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["correlationId"] == "c-1"
    assert body["instance"] == "/api/v1/no-existe"


@pytest.mark.parametrize("error", [OperationalError, InterfaceError])
def test_readiness_responds_down_when_the_database_fails(client, monkeypatch, error):
    def broken() -> None:
        raise error("la base no responde")

    monkeypatch.setattr(container, "check_database", broken)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN"}


@pytest.mark.django_db
def test_readiness_responds_down_when_the_signing_key_is_missing(client, settings):
    settings.JWT_PRIVATE_KEY = ""
    settings.JWT_PRIVATE_KEY_PATH = ""
    container.signing_key.cache_clear()
    try:
        response = client.get("/health/ready")
    finally:
        container.signing_key.cache_clear()

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN"}


def test_403_handler_responds_problem_json(rf):
    handler, _ = get_resolver().resolve_error_handler(403), None

    response = handler(rf.get("/x"), exception=PermissionDenied())

    assert response.status_code == 403
    assert response["Content-Type"] == "application/problem+json"
    assert json.loads(response.content)["code"] == "PERMISSION_DENIED"


def test_check_database_runs_a_real_query(monkeypatch):
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


def test_docs_responds_swagger_ui(client):
    assert client.get("/docs").status_code == 200


def test_disallowed_host_responds_problem_json_not_html(client):
    response = client.get("/health", headers={"host": "evil.example"})

    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    assert response.json()["code"] == "BAD_REQUEST"


def test_unexpected_error_responds_500_problem_json_without_details(monkeypatch):
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
