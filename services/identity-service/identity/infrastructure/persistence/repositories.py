import logging
from datetime import datetime
from uuid import UUID

from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Q

from identity.application.dto import UserDirectoryEntry, UserDirectoryPage
from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.refresh_token import RefreshToken, RefreshTokenLedger
from identity.domain.repository import UserRepository
from identity.domain.role import Role
from identity.domain.user import User
from identity.infrastructure.messaging.integration_events import to_integration_event
from identity.infrastructure.persistence.mappers import to_domain, to_model
from identity.infrastructure.persistence.models import (
    OutboxMessage,
    RevokedRefreshFamily,
    UsedRefreshToken,
    UserModel,
)

logger = logging.getLogger(__name__)


class DjangoUserRepository(UserRepository):
    def exists_with_email(self, email: Email) -> bool:
        return UserModel.objects.filter(email=email.value).exists()

    def get_by_email(self, email: Email) -> User | None:
        model = UserModel.objects.filter(email=email.value).first()
        return to_domain(model) if model is not None else None

    def get_by_id(self, user_id: UUID) -> User | None:
        model = UserModel.objects.filter(id=user_id).first()
        return to_domain(model) if model is not None else None

    def update_password_hash(self, user: User, previous_hash: str) -> None:
        try:
            # El filtro por hash evita restaurar la contraseña vieja si cambió durante este login.
            UserModel.objects.filter(id=user.id, password=previous_hash).update(
                password=user.password_hash
            )
        except DatabaseError as error:
            # La contraseña ya se verificó: el próximo login reintenta. Sin exc_info, para que el
            # hash no llegue al log dentro del error de la base.
            logger.warning(
                "No se pudo actualizar el hash del usuario %s: %s",
                user.id,
                type(error).__name__,
            )

    def update_roles(self, user: User) -> None:
        UserModel.objects.filter(id=user.id).update(roles=sorted(role.value for role in user.roles))

    def update_active(self, user: User) -> None:
        UserModel.objects.filter(id=user.id).update(is_active=user.is_active)

    def add(self, user: User) -> None:
        try:
            # Usuario y eventos en la misma transacción (patrón Outbox): no hay usuario sin evento
            # ni evento sin usuario. El savepoint deja usable una transacción externa si falla.
            with transaction.atomic():
                to_model(user).save(force_insert=True)
                for event in user.pull_events():
                    integration = to_integration_event(event)
                    OutboxMessage.objects.create(
                        id=integration.event_id,
                        topic=integration.topic,
                        aggregate_id=integration.key,
                        envelope=integration.envelope,
                    )
        except IntegrityError as error:
            # Solo un email repetido es un error de negocio. Cualquier otra violación es un bug
            # y debe llegar como 500, no disfrazada de 409.
            if self.exists_with_email(user.email):
                raise EmailAlreadyRegistered("Ya existe un usuario con ese email.") from error
            raise


class DjangoUserDirectory:
    def list_users(self, *, page: int, size: int, role: Role | None) -> UserDirectoryPage:
        users = UserModel.objects.order_by("-date_joined", "-id")
        if role is not None:
            users = users.filter(_has_role(role))
        offset = (page - 1) * size
        # Con .values() la contraseña ni siquiera sale de la base.
        rows = users.values("id", "email", "full_name", "roles", "is_active", "date_joined")
        return UserDirectoryPage(
            data=[
                UserDirectoryEntry(
                    id=row["id"],
                    email=row["email"],
                    full_name=row["full_name"],
                    roles=sorted(row["roles"]),
                    active=row["is_active"],
                    registered_at=row["date_joined"],
                )
                for row in rows[offset : offset + size]
            ],
            number=page,
            size=size,
            total_elements=users.count(),
        )


def _has_role(role: Role) -> Q:
    # `roles__contains` no existe en SQLite, que usan los tests. Mirar cada posición sirve en las
    # dos bases: la lista no tiene repetidos, así que no es más larga que los roles que existen.
    condition = Q()
    for position in range(len(Role)):
        condition |= Q(**{f"roles__{position}": role.value})
    return condition


class DjangoRefreshTokenLedger(RefreshTokenLedger):
    def is_family_revoked(self, family_id: UUID) -> bool:
        return RevokedRefreshFamily.objects.filter(family_id=family_id).exists()

    def mark_used(self, token: RefreshToken) -> bool:
        try:
            with transaction.atomic():
                UsedRefreshToken.objects.create(
                    jti=token.jti,
                    family_id=token.family_id,
                    user_id=token.user_id,
                    expires_at=token.expires_at,
                )
        except IntegrityError:
            logger.warning("Refresh token reutilizado en la familia %s", token.family_id)
            return False
        return True

    def revoke_family(self, family_id: UUID, now: datetime) -> None:
        RevokedRefreshFamily.objects.get_or_create(
            family_id=family_id, defaults={"revoked_at": now}
        )
