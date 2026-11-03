"""Modelo de persistencia del usuario. No es el modelo de dominio: un mapper los traduce."""

import uuid
from typing import ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserModelManager(BaseUserManager["UserModel"]):
    # Solo lo usan los comandos de Django (por ejemplo `createsuperuser`). La API registra
    # usuarios a través del caso de uso del dominio, no con este manager.
    def create_user(self, email: str, password: str | None = None, **extra) -> "UserModel":
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra) -> "UserModel":
        extra.setdefault("roles", ["ADMIN"])
        return self.create_user(email, password, **extra)


class UserModel(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    full_name = models.CharField(max_length=150)
    # Lista de roles en UPPER_SNAKE_CASE (CLIENT, AGENT, ADMIN).
    roles = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserModelManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = ["full_name"]

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return str(self.id)
