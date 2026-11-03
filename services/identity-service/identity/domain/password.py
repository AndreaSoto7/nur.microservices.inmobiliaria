from dataclasses import dataclass, field

from identity.domain.errors import WeakPassword

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


@dataclass(frozen=True, slots=True)
class RawPassword:
    """Contraseña en texto plano: solo vive en memoria durante el caso de uso. Nunca se guarda."""

    value: str = field(repr=False)

    def __post_init__(self) -> None:
        if not MIN_PASSWORD_LENGTH <= len(self.value) <= MAX_PASSWORD_LENGTH:
            raise WeakPassword(
                f"La contraseña debe tener entre {MIN_PASSWORD_LENGTH} "
                f"y {MAX_PASSWORD_LENGTH} caracteres."
            )
