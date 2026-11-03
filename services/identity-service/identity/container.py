"""Composition root: la capa más externa. Arma los handlers con sus adaptadores concretos."""

from datetime import timedelta
from functools import cache

from django.conf import settings

from identity.application.commands.register_user import RegisterUserHandler
from identity.application.queries.authenticate_user import AuthenticateUserHandler
from identity.infrastructure.clock import SystemClock
from identity.infrastructure.persistence.repositories import DjangoUserRepository
from identity.infrastructure.security.keys import SigningKey, jwks, load_signing_key
from identity.infrastructure.security.password_hasher import DjangoPasswordHasher
from identity.infrastructure.security.token_issuer import PyJwtTokenIssuer


def register_user_handler() -> RegisterUserHandler:
    return RegisterUserHandler(
        users=DjangoUserRepository(),
        password_hasher=DjangoPasswordHasher(),
        clock=SystemClock(),
    )


def authenticate_user_handler() -> AuthenticateUserHandler:
    return AuthenticateUserHandler(
        users=DjangoUserRepository(),
        password_hasher=DjangoPasswordHasher(),
        token_issuer=PyJwtTokenIssuer(
            signing_key=signing_key(),
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            access_ttl=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
            refresh_ttl=timedelta(seconds=settings.JWT_REFRESH_TTL_SECONDS),
            clock=SystemClock(),
        ),
    )


@cache
def signing_key() -> SigningKey:
    """Se carga una vez por proceso (cache no guarda errores: readiness reintenta).

    Rotar la clave exige reiniciar, y los tokens firmados con la anterior dejan de validar.
    """
    return load_signing_key(pem=settings.JWT_PRIVATE_KEY, path=settings.JWT_PRIVATE_KEY_PATH)


def public_jwks() -> dict:
    return jwks([signing_key()])
