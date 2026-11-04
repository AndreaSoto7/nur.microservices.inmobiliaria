"""Limpieza de filas que ya no sirven. Sin ella, estas tablas crecen para siempre."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from identity.infrastructure.persistence.models import (
    OutboxMessage,
    RevokedRefreshFamily,
    UsedRefreshToken,
)

# Cubre una rotación en curso justo al vencer, y una pequeña diferencia de reloj entre procesos.
SAFETY_MARGIN = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class PurgeResult:
    used_tokens: int
    revoked_families: int
    outbox_messages: int


def purge_expired(
    *, now: datetime, session_max: timedelta, outbox_retention: timedelta
) -> PurgeResult:
    # Un token vencido se rechaza por `exp` antes de consultar esta tabla.
    used_tokens, _ = UsedRefreshToken.objects.filter(expires_at__lt=now - SAFETY_MARGIN).delete()
    # Un token de la familia no vive más que `session_max` desde el login, y el login fue antes de
    # revocarla. Se usa el tope de la sesión y no el TTL, que puede haber bajado por configuración.
    # Por eso el tope no se baja de golpe: ver "Limpieza periódica" en el README.
    revoked_families, _ = RevokedRefreshFamily.objects.filter(
        revoked_at__lt=now - session_max - SAFETY_MARGIN
    ).delete()
    # `published_at` nulo no entra en el filtro: un evento pendiente nunca se borra.
    outbox_messages, _ = OutboxMessage.objects.filter(
        published_at__lt=now - outbox_retention
    ).delete()
    return PurgeResult(used_tokens, revoked_families, outbox_messages)
