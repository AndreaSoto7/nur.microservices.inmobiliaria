from datetime import UTC, datetime
from uuid import UUID

import jwt

from identity.domain.errors import InvalidAccessToken, InvalidRefreshToken
from identity.domain.refresh_token import RefreshToken
from identity.infrastructure.security.keys import ALGORITHM, SigningKey
from identity.infrastructure.security.token_issuer import ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE

REQUIRED_CLAIMS = ["exp", "iat", "iss", "aud", "sub", "jti", "fid", "auth_time"]


class PyJwtRefreshTokenVerifier:
    """Adapter del puerto RefreshTokenVerifier. Todo problema da InvalidRefreshToken."""

    def __init__(self, *, signing_key: SigningKey, issuer: str):
        self._public_key = signing_key.private_key.public_key()
        self._issuer = issuer

    def verify(self, raw_token: str) -> RefreshToken:
        try:
            if jwt.get_unverified_header(raw_token).get("typ") != REFRESH_TOKEN_TYPE:
                raise InvalidRefreshToken()
            claims = jwt.decode(
                raw_token,
                self._public_key,
                algorithms=[ALGORITHM],
                # El refresh tiene como audiencia al propio emisor: solo identity lo acepta.
                audience=self._issuer,
                issuer=self._issuer,
                options={"require": REQUIRED_CLAIMS},
            )
            return RefreshToken(
                jti=UUID(claims["jti"]),
                user_id=UUID(claims["sub"]),
                family_id=UUID(claims["fid"]),
                expires_at=datetime.fromtimestamp(claims["exp"], UTC),
                session_started_at=datetime.fromtimestamp(claims["auth_time"], UTC),
            )
        except (jwt.PyJWTError, ValueError, TypeError) as error:
            raise InvalidRefreshToken() from error


class PyJwtAccessTokenVerifier:
    """Valida un access token como lo hacen el gateway y los servicios (rule seguridad)."""

    def __init__(self, *, signing_key: SigningKey, issuer: str, audience: str):
        self._public_key = signing_key.private_key.public_key()
        self._issuer = issuer
        self._audience = audience

    def verify(self, raw_token: str) -> UUID:
        """Devuelve el id del usuario. Si algo falla: InvalidAccessToken."""
        try:
            if jwt.get_unverified_header(raw_token).get("typ") != ACCESS_TOKEN_TYPE:
                raise InvalidAccessToken()
            claims = jwt.decode(
                raw_token,
                self._public_key,
                algorithms=[ALGORITHM],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
            return UUID(claims["sub"])
        except (jwt.PyJWTError, ValueError, TypeError) as error:
            raise InvalidAccessToken() from error
