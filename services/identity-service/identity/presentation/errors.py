"""Errores de Django fuera de DRF (400, 403, 404 y 500) en problem+json, nunca en HTML."""

import json

from django.http import HttpRequest, HttpResponse

from identity.presentation.problem import PROBLEM_CONTENT_TYPE, problem


def _problem_response(body: dict) -> HttpResponse:
    return HttpResponse(
        json.dumps(body, ensure_ascii=False),
        status=body["status"],
        content_type=PROBLEM_CONTENT_TYPE,
    )


def bad_request(request: HttpRequest, exception: Exception) -> HttpResponse:
    # Por ejemplo, un Host no permitido o un body que supera el límite de Django.
    return _problem_response(
        problem(
            status=400,
            code="BAD_REQUEST",
            title="Petición inválida",
            instance=request.path,
        )
    )


def permission_denied(request: HttpRequest, exception: Exception) -> HttpResponse:
    return _problem_response(
        problem(
            status=403,
            code="PERMISSION_DENIED",
            title="Sin permiso",
            instance=request.path,
        )
    )


def not_found(request: HttpRequest, exception: Exception) -> HttpResponse:
    return _problem_response(
        problem(
            status=404,
            code="NOT_FOUND",
            title="Recurso no encontrado",
            instance=request.path,
        )
    )


def server_error(request: HttpRequest) -> HttpResponse:
    return _problem_response(
        problem(
            status=500,
            code="INTERNAL_ERROR",
            title="Error interno",
            detail="Ocurrió un error inesperado.",
            instance=request.path,
        )
    )
