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


class MissingRole(DomainError):
    code = "USER_MISSING_ROLE"


class EmailAlreadyRegistered(DomainError):
    code = "USER_EMAIL_ALREADY_REGISTERED"


INVALID_CREDENTIALS_MESSAGE = "Email o contraseña incorrectos."


class InvalidCredentials(DomainError):
    """Mismo mensaje en todos los casos: no se revela si el email existe ni por qué falló."""

    code = "AUTH_INVALID_CREDENTIALS"

    def __init__(self, message: str = INVALID_CREDENTIALS_MESSAGE) -> None:
        super().__init__(message)
