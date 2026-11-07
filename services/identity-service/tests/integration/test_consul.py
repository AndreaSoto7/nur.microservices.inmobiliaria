"""Registro en Consul contra un servidor HTTP falso: no hace falta Consul corriendo."""

import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar

import pytest

from identity.infrastructure.discovery.consul import (
    ServiceRegistration,
    deregister,
    keep_registered,
    register,
)


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
    server.server_close()


def a_registration(consul_url: str) -> ServiceRegistration:
    return ServiceRegistration(
        consul_addr=consul_url,
        name="identity-service",
        port=8001,
        address="172.18.0.7",
        service_id="identity-service-abc123",
    )


def test_registers_the_replica_with_its_ip_and_health_check(consul_url):
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


def test_deregisters_with_its_id(consul_url):
    deregister(a_registration(consul_url))

    assert FakeConsul.requests[0][:2] == (
        "PUT",
        "/v1/agent/service/deregister/identity-service-abc123",
    )


def test_retries_when_consul_does_not_respond_and_does_not_crash_the_service():
    waits: list[float] = []
    registration = ServiceRegistration(
        consul_addr="http://127.0.0.1:1", name="identity-service", port=8001, address="10.0.0.5"
    )

    registered = register(registration, attempts=3, backoff_seconds=0.5, sleep=waits.append)

    assert registered is False
    assert waits == [0.5, 1.0]


@pytest.mark.parametrize("address", ["localhost", "127.0.0.1", "127.0.1.1", "::1"])
def test_does_not_allow_registering_with_a_loopback_address(address):
    with pytest.raises(ValueError):
        ServiceRegistration(
            consul_addr="http://consul:8500",
            name="identity-service",
            port=8001,
            address=address,
        )


def test_invalid_consul_response_does_not_crash_registration():
    # Un servidor que no habla HTTP provoca http.client.HTTPException, que no es OSError.
    server = socket.create_server(("127.0.0.1", 0))

    def answer_garbage() -> None:
        connection, _ = server.accept()
        connection.recv(4096)
        connection.sendall(b"esto no es http\r\n\r\n")
        connection.close()

    threading.Thread(target=answer_garbage, daemon=True).start()
    registration = ServiceRegistration(
        consul_addr=f"http://127.0.0.1:{server.getsockname()[1]}",
        name="identity-service",
        port=8001,
        address="10.0.0.5",
    )

    assert register(registration, attempts=1) is False
    server.close()


def test_repeats_registration_periodically_until_stopped(consul_url):
    stop = threading.Event()
    thread = threading.Thread(
        target=keep_registered,
        args=(a_registration(consul_url), stop),
        kwargs={"interval_seconds": 0.01, "initial_delay_seconds": 0},
    )

    thread.start()
    deadline = time.monotonic() + 3
    while len(FakeConsul.requests) < 3 and time.monotonic() < deadline:
        time.sleep(0.01)
    stop.set()
    thread.join(timeout=2)

    assert not thread.is_alive()
    assert len(FakeConsul.requests) >= 3
    assert all(path == "/v1/agent/service/register" for _, path, _ in FakeConsul.requests)


def test_waits_before_first_registration_to_avoid_racing_the_fork(consul_url):
    # gunicorn crea los workers justo después de when_ready: un hilo activo durante el fork
    # puede dejar a un worker colgado. También le da tiempo al servidor de empezar a escuchar.
    stop = threading.Event()
    thread = threading.Thread(
        target=keep_registered,
        args=(a_registration(consul_url), stop),
        kwargs={"initial_delay_seconds": 30},
    )

    thread.start()
    time.sleep(0.1)
    requests_during_delay = list(FakeConsul.requests)
    stop.set()
    thread.join(timeout=2)

    assert requests_during_delay == []
    assert FakeConsul.requests == []
    assert not thread.is_alive()


@pytest.mark.parametrize("consul_addr", ["http://a..b:8500", "http://[x"])
def test_malformed_address_does_not_kill_the_registration_thread(consul_addr):
    registration = ServiceRegistration(
        consul_addr=consul_addr, name="identity-service", port=8001, address="10.0.0.5"
    )

    assert register(registration, attempts=1) is False


def test_stops_immediately_even_if_consul_does_not_respond():
    stop = threading.Event()
    registration = ServiceRegistration(
        consul_addr="http://127.0.0.1:1", name="identity-service", port=8001, address="10.0.0.5"
    )
    thread = threading.Thread(target=keep_registered, args=(registration, stop))

    thread.start()
    time.sleep(0.05)
    stop.set()
    thread.join(timeout=2)

    assert not thread.is_alive()


def test_default_id_includes_the_hostname(monkeypatch):
    monkeypatch.setattr("socket.gethostname", lambda: "f3a9c1d2e4b5")

    registration = ServiceRegistration.from_env(
        {"CONSUL_HTTP_ADDR": "http://consul:8500", "SERVICE_ADDRESS": "10.0.0.9"}
    )

    assert registration.service_id == "identity-service-f3a9c1d2e4b5"
    assert registration.address == "10.0.0.9"
