from uuid import UUID

from identity.domain.errors import InvalidAccessToken
from identity.domain.repository import UserRepository
from identity.domain.user import User


def require_admin(users: UserRepository, actor_id: UUID) -> User:
    """Autoriza con lo que dice la base, no con el claim `roles` del token.

    El token sigue vigente hasta su `exp`: a un administrador destituido o desactivado no le sirve
    el que todavía tiene.
    """
    actor = users.get_by_id(actor_id)
    if actor is None or not actor.is_active:
        raise InvalidAccessToken()
    actor.ensure_is_admin()
    return actor
