from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class TokenPair:
    """Resultado del login. Los tokens son credenciales: no aparecen en el repr."""

    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)
    expires_in: int
    token_type: str = "Bearer"  # noqa: S105 - es el tipo de token (RFC 6750), no un secreto
