"""Registro del servicio en Consul (self-registration). Ver la rule `service-discovery`.

Solo usa la librería estándar, así se puede llamar desde los hooks de gunicorn sin cargar Django.
"""

import json
import logging
import socket
import time
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

HEALTH_CHECK_INTERVAL = "10s"
HEALTH_CHECK_TIMEOUT = "2s"
DEREGISTER_CRITICAL_AFTER = "1m"
REQUEST_TIMEOUT_SECONDS = 3

Opener = Callable[..., object]


def _container_address() -> str:
    # En Docker, el hostname del contenedor resuelve a su IP en la red interna.
    return socket.gethostbyname(socket.gethostname())


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
        if self.address in ("localhost", "127.0.0.1"):
            raise ValueError("No se registra con localhost: Consul y el gateway no llegarían")
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


def _put(url: str, body: dict | None, opener: Opener) -> None:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(  # noqa: S310 - el esquema se valida en ServiceRegistration
        url, data=data, method="PUT", headers={"Content-Type": "application/json"}
    )
    with opener(request, timeout=REQUEST_TIMEOUT_SECONDS):
        pass


def register(
    registration: ServiceRegistration,
    *,
    attempts: int = 5,
    backoff_seconds: float = 1.0,
    opener: Opener = urllib.request.urlopen,
    sleep: Callable[[float], None] = time.sleep,
) -> bool:
    """Registra la réplica. Reintenta con backoff si Consul todavía no está listo.

    Si se agotan los intentos, loguea el error y devuelve False: el servicio sigue funcionando,
    aunque el gateway no lo vea hasta el próximo reinicio.
    """
    url = f"{registration.consul_addr}/v1/agent/service/register"
    for attempt in range(1, attempts + 1):
        try:
            _put(url, registration.payload(), opener)
        except OSError as error:
            logger.warning("Consul no disponible (intento %s/%s): %s", attempt, attempts, error)
            if attempt < attempts:
                sleep(backoff_seconds * 2 ** (attempt - 1))
        else:
            logger.info("Registrado en Consul como %s", registration.service_id)
            return True
    logger.error("No se pudo registrar %s en Consul", registration.service_id)
    return False


def deregister(
    registration: ServiceRegistration, *, opener: Opener = urllib.request.urlopen
) -> None:
    url = f"{registration.consul_addr}/v1/agent/service/deregister/{registration.service_id}"
    _put(url, None, opener)
    logger.info("Baja en Consul de %s", registration.service_id)
