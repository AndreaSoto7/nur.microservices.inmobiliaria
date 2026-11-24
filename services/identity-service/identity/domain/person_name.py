from dataclasses import dataclass

from identity.domain.errors import InvalidFirstName, InvalidLastName

MAX_NAME_PART_LENGTH = 75


def _clean(value: str) -> str:
    # Los espacios de más entre palabras ("María  José") se reducen a uno.
    return " ".join(value.split())


@dataclass(frozen=True, slots=True)
class PersonName:
    """Nombre y apellido de una persona. Los dos son obligatorios al registrarse."""

    first_name: str
    last_name: str

    def __post_init__(self) -> None:
        first, last = _clean(self.first_name), _clean(self.last_name)
        if not 1 <= len(first) <= MAX_NAME_PART_LENGTH:
            raise InvalidFirstName(
                f"El nombre es obligatorio y tiene como máximo {MAX_NAME_PART_LENGTH} caracteres."
            )
        if not 1 <= len(last) <= MAX_NAME_PART_LENGTH:
            raise InvalidLastName(
                f"El apellido es obligatorio y tiene como máximo {MAX_NAME_PART_LENGTH} caracteres."
            )
        object.__setattr__(self, "first_name", first)
        object.__setattr__(self, "last_name", last)

    @classmethod
    def restore(cls, first_name: str, last_name: str) -> "PersonName":
        """Desde la base. Las cuentas creadas antes de separar nombre y apellido pueden no tener
        apellido: la migración no lo inventa."""
        if _clean(last_name):
            return cls(first_name, last_name)
        name = object.__new__(cls)
        object.__setattr__(name, "first_name", cls(first_name, "-").first_name)
        object.__setattr__(name, "last_name", "")
        return name

    @property
    def full(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self) -> str:
        return self.full
