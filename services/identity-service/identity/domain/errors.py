"""Errores de dominio. Cada uno tiene un `code` estable que la API expone en problem+json."""


class DomainError(Exception):
    code = "DOMAIN_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidEmail(DomainError):
    code = "USER_INVALID_EMAIL"
