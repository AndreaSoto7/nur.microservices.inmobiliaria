"""Liveness y readiness (rule service-discovery). Fuera de /api/v1: no pasan por el gateway."""

from django.db import DatabaseError, connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def liveness(request: HttpRequest) -> JsonResponse:
    # Lo usa Consul. No revisa la base a propósito: si la base parpadea, Consul no debe sacar
    # todas las réplicas a la vez.
    return JsonResponse({"status": "UP"})


@require_GET
def readiness(request: HttpRequest) -> JsonResponse:
    try:
        connection.ensure_connection()
    except DatabaseError:
        return JsonResponse({"status": "DOWN"}, status=503)
    return JsonResponse({"status": "UP"})
