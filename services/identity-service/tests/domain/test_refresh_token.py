from datetime import UTC, datetime

import pytest

from identity.domain.errors import InvalidRefreshToken
from identity.domain.refresh_token import consume
from tests.application.fakes import InMemoryRefreshTokenLedger, a_refresh_token

NOW = datetime(2026, 11, 3, tzinfo=UTC)


def test_new_token_is_consumed_and_marked_used():
    ledger, token = InMemoryRefreshTokenLedger(), a_refresh_token()

    consume(token, ledger, NOW)

    assert token.jti in ledger.used


def test_reusing_a_token_revokes_its_whole_family():
    ledger, token = InMemoryRefreshTokenLedger(), a_refresh_token()
    consume(token, ledger, NOW)

    with pytest.raises(InvalidRefreshToken) as error:
        consume(token, ledger, NOW)

    assert error.value.code == "AUTH_INVALID_REFRESH_TOKEN"
    assert token.family_id in ledger.revoked


def test_new_token_from_a_revoked_family_is_rejected():
    ledger = InMemoryRefreshTokenLedger()
    first = a_refresh_token()
    newer = a_refresh_token(user_id=first.user_id, family_id=first.family_id)
    ledger.revoke_family(first.family_id, NOW)

    with pytest.raises(InvalidRefreshToken):
        consume(newer, ledger, NOW)

    assert newer.jti not in ledger.used
