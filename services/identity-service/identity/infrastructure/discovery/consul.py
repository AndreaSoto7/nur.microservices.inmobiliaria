"""Registro del servicio en Consul (self-registration). Ver la rule `service-discovery`.

Solo usa la librería estándar, así se puede llamar desde los hooks de gunicorn sin cargar Django.
"""

import ipaddress
import json
import logging
import socket
import threading
import time
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from http.client import HTTPException

logger = logging.getLogger(__name__)

HEALTH_CHECK_INTERVAL = "10s"
HEALTH_CHECK_TIMEOUT = "2s"
DEREGISTER_CRITICAL_AFTER = "1m"
REQUEST_TIMEOUT_SECONDS = 3
REREGISTER_INTERVAL_SECONDS = 60.0
RETRY_SECONDS = 5.0


def _container_address() -> str:
    # En Docker, el hostname del contenedor resuelve a su IP en la red interna.
    return socket.gethostbyname(socket.gethostname())


def _is_loopback(address: str) -> bool:
    if address == "localhost":
        return True
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:  # un nombre de host, no una IP
        return False


@dataclass(frozen=True)
class ServiceRegistration:
    consul_addr: str
    name: str
    port: int
    address: str = field(default_factory=_container_address)
    # Un ID por réplica: `<servicio>-<hostname>`. En Docker, el hostname es el ID del contenedor.
    service_id: str = ""

    def __post_init__(self) -> None:
        if not self.consul_addr.startswith(("http://", "https://")):
            raise ValueError("CONSUL_HTTP_ADDR debe empezar con http:// o https://")
        if _is_loopback(self.address):
            raise ValueError("No se registra con loopback: Consul y el gateway no llegarían")
        if not self.service_id:
            object.__setattr__(self, "service_id", f"{self.name}-{socket.gethostname()}")

    @classmethod
    def from_env(cls, environ: Mapping[str, str]) -> "ServiceRegistration":
        optional = {"address": environ["SERVICE_ADDRESS"]} if environ.get("SERVICE_ADDRESS") else {}
        return cls(
            consul_addr=environ.get("CONSUL_HTTP_ADDR", "http://consul:8500").rstrip("/"),
            name=environ.get("SERVICE_NAME", "identity-service"),
            port=int(environ.get("SERVICE_PORT", "8001")),
            **optional,
        )

    def payload(self) -> dict:
        # La API de Consul usa claves en PascalCase.
        return {
            "ID": self.service_id,
            "Name": self.name,
            "Address": self.address,
            "Port": self.port,
            "Check": {
                "HTTP": f"http://{self.address}:{self.port}/health",
                "Interval": HEALTH_CHECK_INTERVAL,
                "Timeout": HEALTH_CHECK_TIMEOUT,
                "DeregisterCriticalServiceAfter": DEREGISTER_CRITICAL_AFTER,
            },
        }


def _put(url: str, body: dict | None) -> None:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(  # noqa: S310 - el esquema se valida en ServiceRegistration
        url, data=data, method="PUT", headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):  # noqa: S310
        pass


def register(
    registration: ServiceRegistration,
    *,
    attempts: int = 5,
    backoff_seconds: float = 1.0,
    sleep: Callable[[float], None] = time.sleep,
) -> bool:
    """Registra la réplica, con reintentos y backoff. Devuelve False si no pudo: nunca lanza."""
    url = f"{registration.consul_addr}/v1/agent/service/register"
    for attempt in range(1, attempts + 1):
        try:
            _put(url, registration.payload())
        except (OSError, HTTPException) as error:
            logger.warning("Consul no disponible (intento %s/%s): %s", attempt, attempts, error)
            if attempt < attempts:
                sleep(backoff_seconds * 2 ** (attempt - 1))
        else:
            return True
    return False


def keep_registered(
    registration: ServiceRegistration,
    stop: threading.Event,
    *,
    interval_seconds: float = REREGISTER_INTERVAL_SECONDS,
    retry_seconds: float = RETRY_SECONDS,
) -> None:
    """Mantiene la réplica registrada hasta que `stop` se active. Pensado para correr en un hilo.

    Consul en modo dev guarda todo en memoria y borra las réplicas que estuvieron críticas, así
    que el registro se repite. Hace un solo intento por vuelta para poder detenerse rápido.
    """
    registered = False
    while not stop.is_set():
        ok = register(registration, attempts=1)
        if ok and not registered:
            logger.info("Registrado en Consul como %s", registration.service_id)
        registered = ok
        stop.wait(interval_seconds if ok else retry_seconds)


def deregister(registration: ServiceRegistration) -> None:
    url = f"{registration.consul_addr}/v1/agent/service/deregister/{registration.service_id}"
    _put(url, None)
    logger.info("Baja en Consul de %s", registration.service_id)
