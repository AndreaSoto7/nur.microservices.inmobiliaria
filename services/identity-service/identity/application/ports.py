"""Puertos de salida de la capa de aplicación. La infraestructura los implementa."""

from datetime import datetime
from typing import Protocol

from identity.application.dto import TokenPair
from identity.domain.password import RawPassword
from identity.domain.refresh_token import RefreshToken
from identity.domain.user import User


class Clock(Protocol):
    """Hora actual inyectable, para que los tests no dependan de la hora real."""

    def now(self) -> datetime: ...


class PasswordHasher(Protocol):
    # Recibe RawPassword, no str: solo se hashea una contraseña que ya pasó la política.
    def hash(self, password: RawPassword) -> str: ...

    def verify(self, raw_password: str, password_hash: str | None) -> bool:
        """Compara una contraseña con su hash. Toda implementación debe cumplir:

        - Recibe str y no RawPassword: en el login no aplica la política de contraseñas (una
          corta no "es débil", simplemente no coincide).
        - Con password_hash=None (o inutilizable) devuelve False **pagando el costo de un hash**,
          para que un email inexistente tarde lo mismo que uno registrado.
        """
        ...

    def needs_rehash(self, password_hash: str) -> bool:
        """True si el hash usa un algoritmo viejo o menos iteraciones que las actuales."""
        ...

    def rehash(self, raw_password: str) -> str:
        """Hashea sin aplicar la política: la contraseña ya existe y se acaba de verificar."""
        ...


class TokenIssuer(Protocol):
    def issue(self, user: User, renewing: RefreshToken | None = None) -> TokenPair:
        """Emite un par de tokens. Con `renewing` continúa esa sesión; sin él abre una nueva."""
        ...


class RefreshTokenVerifier(Protocol):
    def verify(self, raw_token: str) -> RefreshToken:
        """Verifica firma, audiencia, tipo y vencimiento. Si algo falla: InvalidRefreshToken."""
        ...
