from datetime import timedelta
from uuid import uuid4

import jwt

from identity.application.dto import TokenPair
from identity.application.ports import Clock
from identity.domain.refresh_token import RefreshToken
from identity.domain.user import User
from identity.infrastructure.security.keys import ALGORITHM, SigningKey

# Tipado explícito (RFC 8725 §3.11): el access token es "at+jwt" (RFC 9068). Los consumidores
# exigen typ=at+jwt y aud=inmobiliaria, así un refresh token nunca pasa como access token.
ACCESS_TOKEN_TYPE = "at+jwt"  # noqa: S105 - tipo de token, no un secreto
REFRESH_TOKEN_TYPE = "rt+jwt"  # noqa: S105 - tipo de token, no un secreto


class PyJwtTokenIssuer:
    """Adapter del puerto TokenIssuer: firma JWT RS256 con `kid` en el header.

    Claims del access token según CLAUDE.md: sub, email, roles, iss y aud (más iat, exp y jti).
    El refresh token no lleva datos personales y su audiencia es identity-service (el emisor):
    solo identity lo acepta, ningún otro servicio.

    Cada rotación renueva `refresh_ttl`, pero nunca pasa de `session_max` desde el login: al llegar
    al tope el refresh vence como cualquier otro, y hay que volver a iniciar sesión.
    """

    def __init__(
        self,
        *,
        signing_key: SigningKey,
        issuer: str,
        audience: str,
        access_ttl: timedelta,
        refresh_ttl: timedelta,
        session_max: timedelta,
        clock: Clock,
    ):
        self._signing_key = signing_key
        self._issuer = issuer
        self._audience = audience
        self._access_ttl = access_ttl
        self._refresh_ttl = refresh_ttl
        self._session_max = session_max
        self._clock = clock

    def issue(self, user: User, renewing: RefreshToken | None = None) -> TokenPair:
        now = self._clock.now()
        session_started_at = renewing.session_started_at if renewing else now
        refresh_expires_at = min(now + self._refresh_ttl, session_started_at + self._session_max)
        common = {"sub": str(user.id), "iss": self._issuer, "iat": int(now.timestamp())}
        access_token = self._sign(
            ACCESS_TOKEN_TYPE,
            common
            | {
                "aud": self._audience,
                "email": user.email.value,
                "roles": sorted(role.value for role in user.roles),
                "tokenType": "access",
                "jti": str(uuid4()),
                "exp": int((now + self._access_ttl).timestamp()),
            },
        )
        refresh_token = self._sign(
            REFRESH_TOKEN_TYPE,
            common
            | {
                "aud": self._issuer,
                "fid": str(renewing.family_id if renewing else uuid4()),
                "auth_time": int(session_started_at.timestamp()),
                "tokenType": "refresh",
                "jti": str(uuid4()),
                "exp": int(refresh_expires_at.timestamp()),
            },
        )
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int(self._access_ttl.total_seconds()),
        )

    def _sign(self, token_type: str, claims: dict) -> str:
        return jwt.encode(
            claims,
            self._signing_key.private_key,
            algorithm=ALGORITHM,
            headers={"kid": self._signing_key.kid, "typ": token_type},
        )
