"""La limpieza borra solo lo que ya no puede afectar a la seguridad ni a la entrega de eventos."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from django.db import DatabaseError

from identity.infrastructure.persistence.maintenance import PurgeResult, purge_expired
from identity.infrastructure.persistence.management.commands import run_maintenance
from identity.infrastructure.persistence.models import (
    OutboxMessage,
    RevokedRefreshFamily,
    UsedRefreshToken,
)

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 4, 12, 0, tzinfo=UTC)
SESSION_MAX = timedelta(days=30)
OUTBOX_RETENTION = timedelta(days=7)


def purge() -> PurgeResult:
    return purge_expired(now=NOW, session_max=SESSION_MAX, outbox_retention=OUTBOX_RETENTION)


def a_used_token(expires_at: datetime) -> UsedRefreshToken:
    return UsedRefreshToken.objects.create(
        jti=uuid4(), family_id=uuid4(), user_id=uuid4(), expires_at=expires_at
    )


def a_revoked_family(revoked_at: datetime) -> RevokedRefreshFamily:
    return RevokedRefreshFamily.objects.create(family_id=uuid4(), revoked_at=revoked_at)


def an_outbox_message(published_at: datetime | None) -> OutboxMessage:
    return OutboxMessage.objects.create(
        id=uuid4(),
        topic="identity.user.events",
        aggregate_id=str(uuid4()),
        envelope={},
        created_at=NOW - timedelta(days=60),
        published_at=published_at,
    )


def test_deletes_used_tokens_that_already_expired():
    expired = a_used_token(NOW - timedelta(hours=2))

    purge()

    assert not UsedRefreshToken.objects.filter(pk=expired.pk).exists()


@pytest.mark.parametrize("expires_at", [NOW + timedelta(days=1), NOW - timedelta(minutes=30)])
def test_keeps_used_tokens_that_are_valid_or_recently_expired(expires_at):
    # Si se borrara un token todavía vigente, se podría canjear otra vez sin que se detecte el robo.
    kept = a_used_token(expires_at)

    purge()

    assert UsedRefreshToken.objects.filter(pk=kept.pk).exists()


def test_deletes_a_revoked_family_after_the_session_cap():
    old = a_revoked_family(NOW - SESSION_MAX - timedelta(hours=2))

    purge()

    assert not RevokedRefreshFamily.objects.filter(pk=old.pk).exists()


@pytest.mark.parametrize("age", [timedelta(days=8), SESSION_MAX + timedelta(minutes=30)])
def test_keeps_a_revoked_family_while_it_may_have_live_tokens(age):
    # Si se borrara antes, un token de la familia revocada volvería a servir.
    kept = a_revoked_family(NOW - age)

    purge()

    assert RevokedRefreshFamily.objects.filter(pk=kept.pk).exists()


def test_deletes_events_published_more_than_seven_days_ago():
    old = an_outbox_message(NOW - timedelta(days=8))

    purge()

    assert not OutboxMessage.objects.filter(pk=old.pk).exists()


def test_keeps_recently_published_events():
    recent = an_outbox_message(NOW - timedelta(days=1))

    purge()

    assert OutboxMessage.objects.filter(pk=recent.pk).exists()


def test_never_deletes_a_pending_event_even_if_old():
    pending = an_outbox_message(None)

    purge()

    assert OutboxMessage.objects.filter(pk=pending.pk).exists()


def test_reports_how_many_rows_it_deleted():
    a_used_token(NOW - timedelta(hours=2))
    a_revoked_family(NOW - SESSION_MAX - timedelta(hours=2))
    an_outbox_message(NOW - timedelta(days=8))
    an_outbox_message(NOW - timedelta(days=9))

    assert purge() == PurgeResult(used_tokens=1, revoked_families=1, outbox_messages=2)


def test_database_error_does_not_crash_the_cleanup(monkeypatch):
    def broken(**kwargs):
        raise DatabaseError("sin base")

    monkeypatch.setattr(run_maintenance, "purge_expired", broken)
    monkeypatch.setattr(run_maintenance, "close_old_connections", lambda: None)

    run_maintenance.purge_once()


def test_programming_bug_does_crash_the_cleanup(monkeypatch):
    def broken(**kwargs):
        raise TypeError("bug")

    monkeypatch.setattr(run_maintenance, "purge_expired", broken)
    monkeypatch.setattr(run_maintenance, "close_old_connections", lambda: None)

    with pytest.raises(TypeError):
        run_maintenance.purge_once()
