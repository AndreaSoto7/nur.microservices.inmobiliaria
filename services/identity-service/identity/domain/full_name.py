from dataclasses import dataclass

from identity.domain.errors import InvalidFullName

MAX_FULL_NAME_LENGTH = 150


@dataclass(frozen=True, slots=True)
class FullName:
    value: str

    def __post_init__(self) -> None:
        name = self.value.strip()
        if not 1 <= len(name) <= MAX_FULL_NAME_LENGTH:
            raise InvalidFullName(
                f"El nombre es obligatorio y tiene como máximo {MAX_FULL_NAME_LENGTH} caracteres."
            )
        object.__setattr__(self, "value", name)

    def __str__(self) -> str:
        return self.value
