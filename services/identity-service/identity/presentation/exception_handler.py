"""Traduce las excepciones de DRF a problem+json. Los errores de dominio se agregan aquí."""

from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from identity.presentation.problem import PROBLEM_CONTENT_TYPE, problem


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.capitalize() for part in tail)


def _flatten(detail, prefix: str = "") -> list[dict[str, str]]:
    """Convierte el detalle anidado de DRF en `[{field, message}]` con nombres en camelCase."""
    if isinstance(detail, dict):
        items: list[dict[str, str]] = []
        for key, value in detail.items():
            field = f"{prefix}.{_to_camel(str(key))}" if prefix else _to_camel(str(key))
            items.extend(_flatten(value, field))
        return items
    if isinstance(detail, list):
        return [item for value in detail for item in _flatten(value, prefix)]
    return [{"field": prefix or "nonFieldErrors", "message": str(detail)}]


def problem_exception_handler(exc: Exception, context: dict) -> Response | None:
    request = context.get("request")
    instance = request.path if request is not None else None

    if isinstance(exc, ValidationError):
        body = problem(
            status=400,
            code="VALIDATION_ERROR",
            title="Datos inválidos",
            detail="Uno o más campos no son válidos.",
            instance=instance,
            errors=_flatten(exc.detail),
        )
        return Response(body, status=400, content_type=PROBLEM_CONTENT_TYPE)

    if isinstance(exc, APIException):
        body = problem(
            status=exc.status_code,
            code=str(exc.default_code).upper(),
            title=str(exc.default_detail),
            detail=str(exc.detail),
            instance=instance,
        )
        return Response(body, status=exc.status_code, content_type=PROBLEM_CONTENT_TYPE)

    # Cualquier otra excepción la maneja handler500: 500 sin stack trace en la respuesta.
    return None
