import pytest

pytestmark = pytest.mark.django_db


def test_liveness_responde_up(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


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


def test_readiness_responde_down_si_falta_la_clave_de_firma(client, settings):
    from identity import container

    settings.JWT_PRIVATE_KEY = ""
    settings.JWT_PRIVATE_KEY_PATH = ""
    container.signing_key.cache_clear()
    try:
        response = client.get("/health/ready")
    finally:
        container.signing_key.cache_clear()

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN"}
