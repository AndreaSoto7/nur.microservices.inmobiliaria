import re
from dataclasses import dataclass

from identity.domain.errors import InvalidEmail

MAX_EMAIL_LENGTH = 254
_EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


@dataclass(frozen=True, slots=True)
class Email:
    """Value object: se normaliza a minúsculas para que dos formas del mismo email sean iguales."""

    value: str

    def __post_init__(self) -> None:
        normalized = self.value.strip().lower()
        if len(normalized) > MAX_EMAIL_LENGTH or not _EMAIL_PATTERN.fullmatch(normalized):
            raise InvalidEmail(f"'{self.value}' no es un email válido.")
        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
