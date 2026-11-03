"""Registro en Consul contra un servidor HTTP falso: no hace falta Consul corriendo."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar

import pytest

from identity.infrastructure.discovery.consul import ServiceRegistration, deregister, register


class FakeConsul(BaseHTTPRequestHandler):
    requests: ClassVar[list[tuple[str, str, dict | None]]] = []

    def do_PUT(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        FakeConsul.requests.append((self.command, self.path, body))
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture
def consul_url():
    FakeConsul.requests = []
    server = HTTPServer(("127.0.0.1", 0), FakeConsul)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def a_registration(consul_url: str) -> ServiceRegistration:
    return ServiceRegistration(
        consul_addr=consul_url,
        name="identity-service",
        port=8001,
        address="172.18.0.7",
        service_id="identity-service-abc123",
    )


def test_registra_la_replica_con_su_ip_y_health_check(consul_url):
    assert register(a_registration(consul_url)) is True

    method, path, body = FakeConsul.requests[0]
    assert (method, path) == ("PUT", "/v1/agent/service/register")
    assert body["ID"] == "identity-service-abc123"
    assert body["Name"] == "identity-service"
    assert body["Address"] == "172.18.0.7"
    assert body["Port"] == 8001
    assert body["Check"]["HTTP"] == "http://172.18.0.7:8001/health"
    assert body["Check"]["Interval"] == "10s"
    assert body["Check"]["DeregisterCriticalServiceAfter"] == "1m"


def test_se_da_de_baja_con_su_id(consul_url):
    deregister(a_registration(consul_url))

    assert FakeConsul.requests[0][:2] == (
        "PUT",
        "/v1/agent/service/deregister/identity-service-abc123",
    )


def test_si_consul_no_responde_reintenta_y_no_tumba_el_servicio():
    waits: list[float] = []
    registration = ServiceRegistration(
        consul_addr="http://127.0.0.1:1", name="identity-service", port=8001, address="10.0.0.5"
    )

    registered = register(registration, attempts=3, backoff_seconds=0.5, sleep=waits.append)

    assert registered is False
    assert waits == [0.5, 1.0]


def test_no_permite_registrarse_con_localhost():
    with pytest.raises(ValueError):
        ServiceRegistration(
            consul_addr="http://consul:8500",
            name="identity-service",
            port=8001,
            address="localhost",
        )


def test_el_id_por_defecto_incluye_el_hostname(monkeypatch):
    monkeypatch.setattr("socket.gethostname", lambda: "f3a9c1d2e4b5")

    registration = ServiceRegistration.from_env(
        {"CONSUL_HTTP_ADDR": "http://consul:8500", "SERVICE_ADDRESS": "10.0.0.9"}
    )

    assert registration.service_id == "identity-service-f3a9c1d2e4b5"
    assert registration.address == "10.0.0.9"
