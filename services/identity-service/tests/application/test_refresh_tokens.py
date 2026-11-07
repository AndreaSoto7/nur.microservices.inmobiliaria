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


def test_exchanges_the_token_for_a_new_pair_of_the_same_family(
    handler, verifier, ledger, issuer, user
):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token

    tokens = handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert tokens.access_token == f"access-for-{user.id}"
    assert token.jti in ledger.used
    assert issuer.renewed == [token]


def test_unknown_token_is_invalid(handler):
    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="basura"))


def test_reusing_a_token_is_invalid_and_issues_nothing(handler, verifier, issuer, ledger, user):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token
    handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert len(issuer.renewed) == 1
    assert token.family_id in ledger.revoked


def test_nonexistent_user_is_invalid(handler, verifier, issuer):
    verifier.tokens["viejo"] = a_refresh_token()

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert issuer.renewed == []


def test_inactive_user_does_not_refresh_nor_spend_the_token(handler, users, verifier, ledger, user):
    token = a_refresh_token(user_id=user.id)
    verifier.tokens["viejo"] = token
    users.users[user.email.value] = dataclasses.replace(user, is_active=False)

    with pytest.raises(InvalidRefreshToken):
        handler.handle(RefreshTokensCommand(refresh_token="viejo"))

    assert ledger.used == set()


def test_command_does_not_show_the_token_in_repr():
    assert "secreto" not in repr(RefreshTokensCommand(refresh_token="secreto"))
