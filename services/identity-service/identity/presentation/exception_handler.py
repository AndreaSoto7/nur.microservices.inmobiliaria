"""Traduce los errores de dominio y las excepciones de DRF a problem+json."""

from rest_framework import exceptions
from rest_framework.response import Response

from identity.domain import errors
from identity.presentation.problem import PROBLEM_CONTENT_TYPE, problem

# Error de dominio → (status HTTP, título). Un test exige que cada DomainError esté aquí.
DOMAIN_ERRORS: dict[type[errors.DomainError], tuple[int, str]] = {
    errors.InvalidEmail: (400, "Email inválido"),
    errors.InvalidFullName: (400, "Nombre inválido"),
    errors.WeakPassword: (400, "Contraseña débil"),
    errors.RoleNotAllowed: (400, "Rol no permitido"),
    errors.EmailAlreadyRegistered: (409, "Email ya registrado"),
    errors.AdminRequired: (403, "Sin permiso"),
    errors.UserNotFound: (404, "Usuario no encontrado"),
    errors.OwnAccountProtected: (409, "No puedes hacerlo con tu propia cuenta"),
    errors.InvalidCredentials: (401, "Credenciales inválidas"),
    errors.InvalidRefreshToken: (401, "Refresh token inválido"),
    errors.InvalidAccessToken: (401, "Token inválido"),
}
DEFAULT_DOMAIN_ERROR = (409, "Regla de negocio no cumplida")

# Títulos fijos en español para las excepciones de DRF. El default_detail de DRF trae
# placeholders sin formatear ("Método \"{method}\" no permitido.").
API_ERROR_TITLES: dict[type[exceptions.APIException], str] = {
    exceptions.NotAuthenticated: "No autenticado",
    exceptions.AuthenticationFailed: "No autenticado",
    exceptions.PermissionDenied: "Sin permiso",
    exceptions.NotFound: "Recurso no encontrado",
    exceptions.MethodNotAllowed: "Método no permitido",
    exceptions.NotAcceptable: "Formato de respuesta no soportado",
    exceptions.UnsupportedMediaType: "Tipo de contenido no soportado",
    exceptions.Throttled: "Demasiadas peticiones",
}
DEFAULT_API_ERROR_TITLE = "Error en la petición"


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


def _respond(body: dict, headers: dict | None = None) -> Response:
    return Response(body, status=body["status"], content_type=PROBLEM_CONTENT_TYPE, headers=headers)


def problem_exception_handler(exc: Exception, context: dict) -> Response | None:
    request = context.get("request")
    instance = request.path if request is not None else None

    if isinstance(exc, errors.DomainError):
        status, title = DOMAIN_ERRORS.get(type(exc), DEFAULT_DOMAIN_ERROR)
        if isinstance(exc, errors.InvalidAccessToken):
            # Las credenciales viajan en un esquema HTTP: el 401 lo declara (RFC 9110).
            return _respond(
                problem(
                    status=status, code=exc.code, title=title, detail=exc.message, instance=instance
                ),
                headers={"WWW-Authenticate": "Bearer"},
            )
        return _respond(
            problem(
                status=status, code=exc.code, title=title, detail=exc.message, instance=instance
            )
        )

    if isinstance(exc, exceptions.ValidationError):
        return _respond(
            problem(
                status=400,
                code="VALIDATION_ERROR",
                title="Datos inválidos",
                detail="Uno o más campos no son válidos.",
                instance=instance,
                errors=_flatten(exc.detail),
            )
        )

    if isinstance(exc, exceptions.ParseError):
        # No se devuelve el mensaje del parser: expone detalles internos y no aporta al cliente.
        return _respond(
            problem(
                status=400,
                code="VALIDATION_ERROR",
                title="Datos inválidos",
                detail="El cuerpo de la petición no es JSON válido.",
                instance=instance,
            )
        )

    if isinstance(exc, exceptions.APIException):
        return _respond(
            problem(
                status=exc.status_code,
                code=str(exc.default_code).upper(),
                title=API_ERROR_TITLES.get(type(exc), DEFAULT_API_ERROR_TITLE),
                detail=str(exc.detail),
                instance=instance,
            )
        )

    # Cualquier otra excepción la maneja handler500: 500 sin stack trace en la respuesta.
    return None
