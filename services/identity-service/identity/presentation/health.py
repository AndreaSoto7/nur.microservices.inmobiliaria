"""Liveness y readiness (rule service-discovery). Fuera de /api/v1: no pasan por el gateway."""

from django.db import DatabaseError, connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from identity import container
from identity.infrastructure.security.keys import SigningKeyUnavailable


@require_GET
def liveness(request: HttpRequest) -> JsonResponse:
    # Lo usa Consul. No revisa la base a propósito: si la base parpadea, Consul no debe sacar
    # todas las réplicas a la vez.
    return JsonResponse({"status": "UP"})


@require_GET
def readiness(request: HttpRequest) -> JsonResponse:
    try:
        connection.ensure_connection()
        # Sin clave de firma no se puede emitir tokens: el servicio no está listo.
        container.signing_key()
    except (DatabaseError, SigningKeyUnavailable):
        return JsonResponse({"status": "DOWN"}, status=503)
    return JsonResponse({"status": "UP"})
