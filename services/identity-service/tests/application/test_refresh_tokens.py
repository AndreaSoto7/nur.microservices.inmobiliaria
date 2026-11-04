import dataclasses
from datetime import UTC, datetime

import pytest

from identity.application.commands.refresh_tokens import (
    RefreshTokensCommand,
    RefreshTokensHandler,
)
from identity.domain.email import Email
from identity.domain.errors import InvalidRefreshToken
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from tests.application.fakes import (
    FakeRefreshTokenVerifier,
    FakeTokenIssuer,
    FixedClock,
    InMemoryRefreshTokenLedger,
    InMemoryUserRepository,
    a_refresh_token,
)

NOW = datetime(2026, 11, 3, tzinfo=UTC)


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def user(users) -> User:
    user = User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana"),
        password_hash="x",
        role=Role.CLIENT,
        now=NOW,
    )
    users.add(user)
    return user


@pytest.fixture
def verifier() -> FakeRefreshTokenVerifier:
    return FakeRefreshTokenVerifier()


@pytest.fixture
def ledger() -> InMemoryRefreshTokenLedger:
    return InMemoryRefreshTokenLedger()


@pytest.fixture
def issuer() -> FakeTokenIssuer:
    return FakeTokenIssuer()


@pytest.fixture
def handler(users, verifier, ledger, issuer) -> RefreshTokensHandler:
    return RefreshTokensHandler(
        users=users, verifier=verifier, ledger=ledger, token_issuer=issuer, clock=FixedClock(NOW)
    )


def test_canjea_el_token_por_un_par_nuevo_de_la_misma_familia(
    handler, verifier, ledger, issuer, user
):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token

    tokens = handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert tokens.access_token == f"access-for-{user.id}"
    assert token.jti in ledger.used
    assert issuer.family_ids == [token.family_id]


def test_un_token_desconocido_es_invalido(handler):
    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="basura"))


def test_reutilizar_un_token_es_invalido_y_no_emite_nada(handler, verifier, issuer, ledger, user):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token
    handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert len(issuer.family_ids) == 1
    assert token.family_id in ledger.revoked


def test_un_usuario_inexistente_es_invalido(handler, verifier, issuer):
    verifier.tokens["viejo"] = a_refresh_token()

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert issuer.family_ids == []


def test_un_usuario_inactivo_no_renueva_y_no_gasta_el_token(handler, users, verifier, ledger, user):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token
    users.users[user.email.value] = dataclasses.replace(user, is_active=False)

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert ledger.used == set()


def test_el_comando_no_muestra_el_token_en_repr():
    assert "secreto" not in repr(RefreshTokensCommand(refresh_token="secreto"))
