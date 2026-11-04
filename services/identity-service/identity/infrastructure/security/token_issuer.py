from datetime import timedelta
from uuid import UUID, uuid4

import jwt

from identity.application.dto import TokenPair
from identity.application.ports import Clock
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
    """

    def __init__(
        self,
        *,
        signing_key: SigningKey,
        issuer: str,
        audience: str,
        access_ttl: timedelta,
        refresh_ttl: timedelta,
        clock: Clock,
    ):
        self._signing_key = signing_key
        self._issuer = issuer
        self._audience = audience
        self._access_ttl = access_ttl
        self._refresh_ttl = refresh_ttl
        self._clock = clock

    def issue(self, user: User, family_id: UUID | None = None) -> TokenPair:
        now = self._clock.now()
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
                "fid": str(family_id or uuid4()),
                "tokenType": "refresh",
                "jti": str(uuid4()),
                "exp": int((now + self._refresh_ttl).timestamp()),
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
