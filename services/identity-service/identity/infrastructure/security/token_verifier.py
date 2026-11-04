from datetime import UTC, datetime
from uuid import UUID

import jwt

from identity.domain.errors import InvalidRefreshToken
from identity.domain.refresh_token import RefreshToken
from identity.infrastructure.security.keys import ALGORITHM, SigningKey
from identity.infrastructure.security.token_issuer import REFRESH_TOKEN_TYPE

REQUIRED_CLAIMS = ["exp", "iat", "iss", "aud", "sub", "jti", "fid"]


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
            )
        except (jwt.PyJWTError, ValueError, TypeError) as error:
            raise InvalidRefreshToken() from error
