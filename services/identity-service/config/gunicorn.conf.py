"""Configuración de gunicorn para el contenedor.

Los hooks `when_ready` y `on_exit` corren en el proceso maestro, una sola vez por contenedor.
Por eso el registro en Consul va aquí y no en cada worker (rule stack-django).
"""

import os

_port = os.environ.get("SERVICE_PORT", "8001")

# Dentro del contenedor se escucha en todas las interfaces: así llegan Consul y el gateway.
bind = f"0.0.0.0:{_port}"
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
# Cada request ya se loguea en JSON en RequestLoggingMiddleware.
accesslog = None

_registration = None


def _consul_enabled() -> bool:
    return os.environ.get("CONSUL_ENABLED", "false").lower() == "true"


def when_ready(server):
    global _registration
    if not _consul_enabled():
        return
    from identity.infrastructure.discovery.consul import ServiceRegistration, register

    _registration = ServiceRegistration.from_env(os.environ)
    if register(_registration):
        server.log.info("Registrado en Consul como %s", _registration.service_id)
    else:
        server.log.error("No se pudo registrar %s en Consul", _registration.service_id)


def on_exit(server):
    if _registration is None:
        return
    from identity.infrastructure.discovery.consul import deregister

    try:
        deregister(_registration)
    except OSError as error:
        server.log.warning("No se pudo dar de baja en Consul: %s", error)
    else:
        server.log.info("Baja en Consul de %s", _registration.service_id)
