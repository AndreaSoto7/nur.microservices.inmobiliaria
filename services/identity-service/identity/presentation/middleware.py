import logging
import re
import time
import uuid

from django.http import HttpRequest, HttpResponse

from identity.infrastructure.observability import correlation_id

CORRELATION_HEADER = "X-Correlation-Id"
# Solo se acepta un valor "limpio": evita que alguien inyecte saltos de línea o basura en los logs.
_VALID_CORRELATION_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")
# Consul pide /health cada 10 s por réplica: no vale la pena loguearlo.
_UNLOGGED_PATHS = ("/health", "/health/ready")

logger = logging.getLogger("identity.request")


class CorrelationIdMiddleware:
    """Toma el X-Correlation-Id que manda el gateway o genera uno, y lo devuelve en la respuesta."""

    def __init__(self, get_response) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get(CORRELATION_HEADER, "")
        value = incoming if _VALID_CORRELATION_ID.fullmatch(incoming) else str(uuid.uuid4())
        token = correlation_id.set(value)
        try:
            response = self.get_response(request)
        finally:
            correlation_id.reset(token)
        response[CORRELATION_HEADER] = value
        return response


class RequestLoggingMiddleware:
    """Una línea de log por request: método, ruta, status y duración (rule api-rest)."""

    def __init__(self, get_response) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        started = time.perf_counter()
        response = self.get_response(request)
        if request.path not in _UNLOGGED_PATHS:
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "durationMs": round((time.perf_counter() - started) * 1000, 1),
                },
            )
        return response
