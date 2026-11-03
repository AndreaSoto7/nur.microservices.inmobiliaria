"""Configuración de gunicorn para el contenedor.

Los hooks `when_ready` y `on_exit` corren en el proceso maestro, una sola vez por contenedor.
Por eso el registro en Consul va aquí y no en cada worker (rule stack-django).
"""

import os
import threading
from http.client import HTTPException

_port = os.environ.get("SERVICE_PORT", "8001")

# Dentro del contenedor se escucha en todas las interfaces: así llegan Consul y el gateway.
bind = f"0.0.0.0:{_port}"
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
# Con hilos, dos clientes lentos no bloquean todo el servicio (con workers sync, sí).
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "4"))
# Menos que los 10 s de `docker stop`: si no, Docker mata el proceso y la baja en Consul no ocurre.
graceful_timeout = 5
# Cada request ya se loguea en JSON en RequestLoggingMiddleware.
accesslog = None
# El maestro no carga Django: sin esto, sus logs y los de Consul no saldrían en JSON.
logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "identity.infrastructure.observability.JsonFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"gunicorn.error": {"handlers": [], "propagate": True, "level": "INFO"}},
}

_registration = None
_stop = threading.Event()
_thread = None


def _consul_enabled() -> bool:
    return os.environ.get("CONSUL_ENABLED", "false").lower() == "true"


def when_ready(server):
    # El registro corre en un hilo: si Consul no responde, no frena el arranque de los workers.
    global _registration, _thread
    if not _consul_enabled():
        server.log.info("Registro en Consul desactivado (CONSUL_ENABLED)")
        return
    from identity.infrastructure.discovery.consul import ServiceRegistration, keep_registered

    try:
        _registration = ServiceRegistration.from_env(os.environ)
    except OSError as error:  # no se pudo resolver la IP del contenedor
        server.log.error("No se puede registrar en Consul: %s", error)
        return
    _thread = threading.Thread(target=keep_registered, args=(_registration, _stop), daemon=True)
    _thread.start()


def on_exit(server):
    if _registration is None:
        return
    from identity.infrastructure.discovery.consul import REQUEST_TIMEOUT_SECONDS, deregister

    # Primero se detiene el hilo: así un registro tardío no llega a Consul después de la baja.
    _stop.set()
    _thread.join(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        deregister(_registration)
    except (OSError, HTTPException) as error:
        server.log.warning("No se pudo dar de baja en Consul: %s", error)
