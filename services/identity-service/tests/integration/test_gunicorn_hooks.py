"""Hooks de gunicorn: el registro en Consul no debe bloquear el arranque ni el apagado."""

import importlib.util
import json
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


def test_usa_workers_con_hilos_y_deja_margen_frente_a_docker_stop():
    conf = load_conf()

    assert conf.worker_class == "gthread"
    assert conf.threads > 1
    assert conf.graceful_timeout < 10


def test_sin_consul_habilitado_no_registra_y_lo_avisa(monkeypatch):
    monkeypatch.setenv("CONSUL_ENABLED", "false")
    conf, server = load_conf(), Server()

    conf.when_ready(server)
    conf.on_exit(server)

    assert any("Consul" in message for message in server.log.messages)


def test_con_consul_caido_when_ready_no_bloquea_y_on_exit_cierra_rapido(monkeypatch):
    set_env(monkeypatch, "http://127.0.0.1:1")
    conf, server = load_conf(), Server()

    started = time.monotonic()
    conf.when_ready(server)
    assert time.monotonic() - started < 0.5

    started = time.monotonic()
    conf.on_exit(server)
    assert time.monotonic() - started < 5


def test_la_baja_es_lo_ultimo_que_recibe_consul(monkeypatch, consul_url):
    set_env(monkeypatch, consul_url)
    conf, server = load_conf(), Server()

    conf.when_ready(server)
    deadline = time.monotonic() + 3
    while not FakeConsul.paths and time.monotonic() < deadline:
        time.sleep(0.01)
    conf.on_exit(server)

    assert FakeConsul.paths[0] == "/v1/agent/service/register"
    assert FakeConsul.paths[-1].startswith("/v1/agent/service/deregister/")


def test_una_direccion_invalida_de_consul_falla_al_arrancar(monkeypatch):
    monkeypatch.setenv("CONSUL_ENABLED", "true")
    monkeypatch.setenv("CONSUL_HTTP_ADDR", "consul:8500")
    monkeypatch.setenv("SERVICE_ADDRESS", "10.0.0.5")

    with pytest.raises(ValueError):
        load_conf().when_ready(Server())
