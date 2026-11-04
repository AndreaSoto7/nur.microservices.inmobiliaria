"""Composition root: la capa más externa. Arma los handlers con sus adaptadores concretos."""

import logging
from datetime import timedelta
from functools import cache

from django.conf import settings
from django.db import Error as DatabaseError

from identity.application.commands.refresh_tokens import RefreshTokensHandler
from identity.application.commands.register_user import RegisterUserHandler
from identity.application.queries.authenticate_user import AuthenticateUserHandler
from identity.infrastructure.clock import SystemClock
from identity.infrastructure.persistence.health import check_database
from identity.infrastructure.persistence.repositories import (
    DjangoRefreshTokenLedger,
    DjangoUserRepository,
)
from identity.infrastructure.security.keys import (
    SigningKey,
    SigningKeyUnavailable,
    jwks,
    load_signing_key,
)
from identity.infrastructure.security.password_hasher import DjangoPasswordHasher
from identity.infrastructure.security.token_issuer import PyJwtTokenIssuer
from identity.infrastructure.security.token_verifier import PyJwtRefreshTokenVerifier

logger = logging.getLogger(__name__)


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
        token_issuer=_token_issuer(),
    )


def refresh_tokens_handler() -> RefreshTokensHandler:
    return RefreshTokensHandler(
        users=DjangoUserRepository(),
        verifier=_refresh_token_verifier(),
        ledger=DjangoRefreshTokenLedger(),
        token_issuer=_token_issuer(),
        clock=SystemClock(),
    )


def _token_issuer() -> PyJwtTokenIssuer:
    return PyJwtTokenIssuer(
        signing_key=signing_key(),
        issuer=settings.JWT_ISSUER,
        audience=settings.JWT_AUDIENCE,
        access_ttl=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
        refresh_ttl=timedelta(seconds=settings.JWT_REFRESH_TTL_SECONDS),
        clock=SystemClock(),
    )


def _refresh_token_verifier() -> PyJwtRefreshTokenVerifier:
    return PyJwtRefreshTokenVerifier(signing_key=signing_key(), issuer=settings.JWT_ISSUER)


@cache
def signing_key() -> SigningKey:
    """Se carga una vez por proceso (cache no guarda errores: readiness reintenta).

    Rotar la clave exige reiniciar, y los tokens firmados con la anterior dejan de validar.
    """
    return load_signing_key(pem=settings.JWT_PRIVATE_KEY, path=settings.JWT_PRIVATE_KEY_PATH)


def public_jwks() -> dict:
    return jwks([signing_key()])


def is_ready() -> bool:
    """Readiness: la base responde y hay clave de firma. El motivo del fallo queda en el log."""
    try:
        check_database()
        signing_key()
    except (DatabaseError, SigningKeyUnavailable):
        logger.warning("El servicio no está listo", exc_info=True)
        return False
    return True
