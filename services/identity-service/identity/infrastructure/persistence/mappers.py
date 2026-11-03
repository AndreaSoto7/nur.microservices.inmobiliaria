"""Traducción entre el aggregate User (dominio) y UserModel (persistencia)."""

from identity.domain.email import Email
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from identity.infrastructure.persistence.models import UserModel


def to_model(user: User) -> UserModel:
    return UserModel(
        id=user.id,
        email=user.email.value,
        full_name=user.full_name.value,
        password=user.password_hash,
        roles=sorted(role.value for role in user.roles),
        is_active=user.is_active,
        date_joined=user.registered_at,
    )


def to_domain(model: UserModel) -> User:
    return User(
        id=model.id,
        email=Email(model.email),
        full_name=FullName(model.full_name),
        password_hash=model.password,
        roles=frozenset(Role(role) for role in model.roles),
        is_active=model.is_active,
        registered_at=model.date_joined,
    )
