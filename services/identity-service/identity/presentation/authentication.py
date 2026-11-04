"""Autenticación con access token (Bearer) para los endpoints protegidos de identity."""

from dataclasses import dataclass
from uuid import UUID

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.request import Request

from identity import container
from identity.domain.errors import InvalidAccessToken


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: UUID
    is_authenticated: bool = True


class BearerAuthentication(BaseAuthentication):
    def authenticate(self, request: Request) -> tuple[AuthenticatedUser, None]:
        scheme, _, token = get_authorization_header(request).decode("latin-1").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise InvalidAccessToken()
        return AuthenticatedUser(id=container.access_token_verifier().verify(token.strip())), None

    def authenticate_header(self, request: Request) -> str:
        return "Bearer"
