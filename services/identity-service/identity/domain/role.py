from enum import StrEnum

from identity.domain.errors import RoleNotAllowed

ROLE_NOT_ALLOWED_MESSAGE = "Solo se puede registrar con rol CLIENT o AGENT."


class Role(StrEnum):
    CLIENT = "CLIENT"
    AGENT = "AGENT"
    ADMIN = "ADMIN"

    @classmethod
    def parse(cls, value: str) -> "Role":
        try:
            return cls(value)
        except ValueError:
            raise RoleNotAllowed(ROLE_NOT_ALLOWED_MESSAGE) from None


# ADMIN nunca se obtiene por registro público (contrato registerUser).
SELF_REGISTRABLE_ROLES = frozenset({Role.CLIENT, Role.AGENT})
DEFAULT_SELF_REGISTRATION_ROLE = Role.CLIENT


def self_registration_role(value: str | None) -> Role:
    """Rol pedido al autorregistrarse: CLIENT si no se indica, y nunca ADMIN."""
    if not value:
        return DEFAULT_SELF_REGISTRATION_ROLE
    role = Role.parse(value)
    if role not in SELF_REGISTRABLE_ROLES:
        raise RoleNotAllowed(ROLE_NOT_ALLOWED_MESSAGE)
    return role
