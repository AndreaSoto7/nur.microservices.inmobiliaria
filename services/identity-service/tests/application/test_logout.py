from datetime import UTC, datetime

import pytest

from identity.application.commands.logout import LogoutCommand, LogoutHandler
from identity.domain.errors import InvalidRefreshToken
from tests.application.fakes import (
    FakeRefreshTokenVerifier,
    FixedClock,
    InMemoryRefreshTokenLedger,
    a_refresh_token,
)

NOW = datetime(2026, 11, 3, tzinfo=UTC)


@pytest.fixture
def verifier() -> FakeRefreshTokenVerifier:
    return FakeRefreshTokenVerifier()


@pytest.fixture
def ledger() -> InMemoryRefreshTokenLedger:
    return InMemoryRefreshTokenLedger()


@pytest.fixture
def handler(verifier, ledger) -> LogoutHandler:
    return LogoutHandler(verifier=verifier, ledger=ledger, clock=FixedClock(NOW))


def test_revokes_the_token_family(handler, verifier, ledger):
    token = a_refresh_token()
    verifier.tokens["token"] = token

    handler.handle(LogoutCommand(refresh_token="token"))

    assert token.family_id in ledger.revoked


def test_closing_an_already_closed_session_does_not_fail(handler, verifier, ledger):
    token = a_refresh_token()
    verifier.tokens["token"] = token

    handler.handle(LogoutCommand(refresh_token="token"))
    handler.handle(LogoutCommand(refresh_token="token"))

    assert token.family_id in ledger.revoked


def test_invalid_token_raises_invalid_refresh_token(handler):
    with pytest.raises(InvalidRefreshToken):
        handler.handle(LogoutCommand(refresh_token="basura"))


def test_command_does_not_show_the_token_in_repr():
    assert "secreto" not in repr(LogoutCommand(refresh_token="secreto"))
