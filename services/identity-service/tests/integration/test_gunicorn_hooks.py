"""Hooks de gunicorn: el registro en Consul no debe bloquear el arranque ni el apagado."""

import importlib.util
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import ClassVar

import pytest

CONF = Path(__file__).resolve().parents[2] / "config" / "gunicorn.conf.py"


class Log:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def info(self, message, *args):
        self.messages.append(message % args)

    warning = error = info


class Server:
    def __init__(self) -> None:
        self.log = Log()


def load_conf():
    spec = importlib.util.spec_from_file_location("gunicorn_conf", CONF)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeConsul(BaseHTTPRequestHandler):
    paths: ClassVar[list[str]] = []

    def do_PUT(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            json.loads(self.rfile.read(length))
        FakeConsul.paths.append(self.path)
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture
def consul_url():
    FakeConsul.paths = []
    server = HTTPServer(("127.0.0.1", 0), FakeConsul)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


def set_env(monkeypatch, consul_addr: str) -> None:
    monkeypatch.setenv("CONSUL_ENABLED", "true")
    monkeypatch.setenv("CONSUL_HTTP_ADDR", consul_addr)
    monkeypatch.setenv("SERVICE_ADDRESS", "10.0.0.5")


def conf_max_exit_seconds() -> int:
    # on_exit espera al hilo y después hace la baja: dos timeouts de Consul como máximo.
    from identity.infrastructure.discovery.consul import REQUEST_TIMEOUT_SECONDS

    return 2 * REQUEST_TIMEOUT_SECONDS


def test_uses_threaded_workers_and_leaves_room_before_docker_stop():
    conf = load_conf()

    assert conf.worker_class == "gthread"
    assert conf.threads > 1
    assert conf.graceful_timeout + conf_max_exit_seconds() < 10


def test_without_consul_enabled_does_not_register_and_warns(monkeypatch):
    monkeypatch.setenv("CONSUL_ENABLED", "false")
    conf, server = load_conf(), Server()

    conf.when_ready(server)
    conf.on_exit(server)

    assert any("Consul" in message for message in server.log.messages)


def test_with_hung_consul_when_ready_does_not_block_and_on_exit_finishes(monkeypatch):
    # Un socket que acepta y nunca responde: el puerto cerrado rechazaría al instante y un
    # registro síncrono también pasaría este test.
    hanging = socket.create_server(("127.0.0.1", 0))
    set_env(monkeypatch, f"http://127.0.0.1:{hanging.getsockname()[1]}")
    conf, server = load_conf(), Server()

    started = time.monotonic()
    conf.when_ready(server)
    assert time.monotonic() - started < 0.5

    started = time.monotonic()
    conf.on_exit(server)
    assert time.monotonic() - started < 7
    hanging.close()


def test_deregistration_is_the_last_thing_consul_receives(monkeypatch, consul_url):
    set_env(monkeypatch, consul_url)
    conf, server = load_conf(), Server()

    conf.when_ready(server)
    deadline = time.monotonic() + 5
    while not FakeConsul.paths and time.monotonic() < deadline:
        time.sleep(0.01)
    conf.on_exit(server)

    assert not conf._thread.is_alive()
    assert FakeConsul.paths[0] == "/v1/agent/service/register"
    assert FakeConsul.paths[-1].startswith("/v1/agent/service/deregister/")


def test_invalid_consul_address_fails_at_startup(monkeypatch):
    monkeypatch.setenv("CONSUL_ENABLED", "true")
    monkeypatch.setenv("CONSUL_HTTP_ADDR", "consul:8500")
    monkeypatch.setenv("SERVICE_ADDRESS", "10.0.0.5")

    with pytest.raises(ValueError):
        load_conf().when_ready(Server())
