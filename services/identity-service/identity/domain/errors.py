"""Errores de dominio. Cada uno tiene un `code` estable que la API expone en problem+json."""


class DomainError(Exception):
    code = "DOMAIN_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidEmail(DomainError):
    code = "USER_INVALID_EMAIL"


class InvalidFullName(DomainError):
    code = "USER_INVALID_FULL_NAME"


class WeakPassword(DomainError):
    code = "USER_WEAK_PASSWORD"


class RoleNotAllowed(DomainError):
    code = "USER_ROLE_NOT_ALLOWED"


class EmailAlreadyRegistered(DomainError):
    code = "USER_EMAIL_ALREADY_REGISTERED"


class AdminRequired(DomainError):
    code = "USER_ADMIN_REQUIRED"

    def __init__(self, message: str = "Solo un administrador puede hacer esto.") -> None:
        super().__init__(message)


class UserNotFound(DomainError):
    code = "USER_NOT_FOUND"

    def __init__(self, message: str = "El usuario no existe.") -> None:
        super().__init__(message)


class OwnAccountProtected(DomainError):
    """Un administrador no se quita su rol ni se desactiva: así nunca faltan administradores."""

    code = "USER_OWN_ACCOUNT_PROTECTED"


INVALID_CREDENTIALS_MESSAGE = "Email o contraseña incorrectos."


class InvalidAccessToken(DomainError):
    code = "AUTH_INVALID_TOKEN"

    def __init__(self, message: str = "El token de acceso no es válido.") -> None:
        super().__init__(message)


INVALID_REFRESH_TOKEN_MESSAGE = "La sesión no es válida. Inicia sesión de nuevo."  # noqa: S105


class InvalidRefreshToken(DomainError):
    """Mismo mensaje si es inválido, venció o se reutilizó: no se da pista de cuál fue."""

    code = "AUTH_INVALID_REFRESH_TOKEN"

    def __init__(self, message: str = INVALID_REFRESH_TOKEN_MESSAGE) -> None:
        super().__init__(message)


class InvalidCredentials(DomainError):
    """Mismo mensaje en todos los casos: no se revela si el email existe ni por qué falló."""

    code = "AUTH_INVALID_CREDENTIALS"

    def __init__(self, message: str = INVALID_CREDENTIALS_MESSAGE) -> None:
        super().__init__(message)
