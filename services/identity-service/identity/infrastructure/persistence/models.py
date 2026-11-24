"""Modelo de persistencia del usuario. No es el modelo de dominio: un mapper los traduce."""

import uuid
from typing import ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone

from identity.domain.email import Email
from identity.domain.person_name import PersonName


class UserModelManager(BaseUserManager["UserModel"]):
    # Solo lo usan los comandos de Django (por ejemplo `createsuperuser`). La API registra
    # usuarios a través del caso de uso del dominio, no con este manager.
    def create_user(self, email: str, password: str | None = None, **extra) -> "UserModel":
        # Mismas reglas que el dominio: una fila sin roles o con otro email no se podría cargar.
        extra.setdefault("roles", ["CLIENT"])
        name = PersonName(extra.get("first_name", ""), extra.get("last_name", ""))
        extra["first_name"], extra["last_name"] = name.first_name, name.last_name
        user = self.model(email=Email(email).value, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra) -> "UserModel":
        extra.setdefault("roles", ["ADMIN"])
        return self.create_user(email, password, **extra)


class OutboxMessage(models.Model):
    """Evento de integración pendiente de publicar. Se escribe en la transacción del agregado."""

    id = models.UUIDField(primary_key=True)
    topic = models.CharField(max_length=255)
    aggregate_id = models.CharField(max_length=36)
    envelope = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    published_at = models.DateTimeField(null=True, db_index=True)

    class Meta:
        db_table = "outbox"

    def __str__(self) -> str:
        return str(self.id)


class UsedRefreshToken(models.Model):
    """Refresh tokens ya canjeados. El PK garantiza que dos canjes simultáneos no pasen ambos."""

    jti = models.UUIDField(primary_key=True)
    family_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField()
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "used_refresh_tokens"

    def __str__(self) -> str:
        return str(self.jti)


class RevokedRefreshFamily(models.Model):
    family_id = models.UUIDField(primary_key=True)
    revoked_at = models.DateTimeField()

    class Meta:
        db_table = "revoked_refresh_families"

    def __str__(self) -> str:
        return str(self.family_id)


class UserModel(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    first_name = models.CharField(max_length=75)
    # Vacío solo en cuentas creadas antes de separar nombre y apellido (migración 0004).
    last_name = models.CharField(max_length=75, blank=True)
    # Lista de roles en UPPER_SNAKE_CASE (CLIENT, AGENT, ADMIN).
    roles = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserModelManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = ["first_name", "last_name"]

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return str(self.id)
