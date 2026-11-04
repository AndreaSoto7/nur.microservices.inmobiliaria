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


def test_borra_los_tokens_usados_que_ya_vencieron():
    expired = a_used_token(NOW - timedelta(hours=2))

    purge()

    assert not UsedRefreshToken.objects.filter(pk=expired.pk).exists()


@pytest.mark.parametrize("expires_at", [NOW + timedelta(days=1), NOW - timedelta(minutes=30)])
def test_conserva_los_tokens_usados_vigentes_o_recien_vencidos(expires_at):
    # Si se borrara un token todavía vigente, se podría canjear otra vez sin que se detecte el robo.
    kept = a_used_token(expires_at)

    purge()

    assert UsedRefreshToken.objects.filter(pk=kept.pk).exists()


def test_borra_una_familia_revocada_despues_del_tope_de_la_sesion():
    old = a_revoked_family(NOW - SESSION_MAX - timedelta(hours=2))

    purge()

    assert not RevokedRefreshFamily.objects.filter(pk=old.pk).exists()


@pytest.mark.parametrize("age", [timedelta(days=8), SESSION_MAX + timedelta(minutes=30)])
def test_conserva_una_familia_revocada_mientras_pueda_tener_tokens_vivos(age):
    # Si se borrara antes, un token de la familia revocada volvería a servir.
    kept = a_revoked_family(NOW - age)

    purge()

    assert RevokedRefreshFamily.objects.filter(pk=kept.pk).exists()


def test_borra_los_eventos_publicados_hace_mas_de_siete_dias():
    old = an_outbox_message(NOW - timedelta(days=8))

    purge()

    assert not OutboxMessage.objects.filter(pk=old.pk).exists()


def test_conserva_los_eventos_publicados_recientemente():
    recent = an_outbox_message(NOW - timedelta(days=1))

    purge()

    assert OutboxMessage.objects.filter(pk=recent.pk).exists()


def test_nunca_borra_un_evento_pendiente_aunque_sea_viejo():
    pending = an_outbox_message(None)

    purge()

    assert OutboxMessage.objects.filter(pk=pending.pk).exists()


def test_informa_cuantas_filas_borro():
    a_used_token(NOW - timedelta(hours=2))
    a_revoked_family(NOW - SESSION_MAX - timedelta(hours=2))
    an_outbox_message(NOW - timedelta(days=8))
    an_outbox_message(NOW - timedelta(days=9))

    assert purge() == PurgeResult(used_tokens=1, revoked_families=1, outbox_messages=2)


def test_un_error_de_base_no_tumba_la_limpieza(monkeypatch):
    def broken(**kwargs):
        raise DatabaseError("sin base")

    monkeypatch.setattr(run_maintenance, "purge_expired", broken)
    monkeypatch.setattr(run_maintenance, "close_old_connections", lambda: None)

    run_maintenance.purge_once()


def test_un_bug_de_programacion_si_tumba_la_limpieza(monkeypatch):
    def broken(**kwargs):
        raise TypeError("bug")

    monkeypatch.setattr(run_maintenance, "purge_expired", broken)
    monkeypatch.setattr(run_maintenance, "close_old_connections", lambda: None)

    with pytest.raises(TypeError):
        run_maintenance.purge_once()
