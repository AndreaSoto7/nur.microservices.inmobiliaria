"""Composition root: la capa más externa. Arma los handlers con sus adaptadores concretos."""

from identity.application.commands.register_user import RegisterUserHandler
from identity.infrastructure.clock import SystemClock
from identity.infrastructure.persistence.repositories import DjangoUserRepository
from identity.infrastructure.security.password_hasher import DjangoPasswordHasher


def register_user_handler() -> RegisterUserHandler:
    return RegisterUserHandler(
        users=DjangoUserRepository(),
        password_hasher=DjangoPasswordHasher(),
        clock=SystemClock(),
    )
