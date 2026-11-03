from django.contrib.auth.hashers import make_password

from identity.domain.password import RawPassword


class DjangoPasswordHasher:
    """Adapter del puerto PasswordHasher con los hashers de Django (PBKDF2 por defecto)."""

    def hash(self, password: RawPassword) -> str:
        return make_password(password.value)
