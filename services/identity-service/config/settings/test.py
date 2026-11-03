"""Tests con pytest. No necesitan `.env` ni PostgreSQL: usan SQLite en memoria.

Para correr la integración contra PostgreSQL, exporta `DATABASE_URL` antes de `pytest`.
"""

import os

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

os.environ.setdefault("DJANGO_SECRET_KEY", "solo-para-tests-no-es-un-secreto")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")

from .base import *  # noqa: F403

DEBUG = False

# PBKDF2 es lento a propósito. En tests basta un hasher rápido: lo que se prueba es que se hashee.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Clave de firma efímera, generada al cargar los tests. Nunca se escribe a disco.
JWT_PRIVATE_KEY = (
    rsa.generate_private_key(public_exponent=65537, key_size=2048)
    .private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    .decode()
)
