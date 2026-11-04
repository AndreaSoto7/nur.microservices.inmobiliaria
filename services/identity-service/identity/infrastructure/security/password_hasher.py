from django.contrib.auth.hashers import (
    check_password,
    get_hasher,
    identify_hasher,
    is_password_usable,
    make_password,
)

from identity.domain.password import RawPassword


class DjangoPasswordHasher:
    """Adapter del puerto PasswordHasher con los hashers de Django (PBKDF2 por defecto)."""

    def hash(self, password: RawPassword) -> str:
        return make_password(password.value)

    def verify(self, raw_password: str, password_hash: str | None) -> bool:
        if password_hash is None or not is_password_usable(password_hash):
            # Sin usuario, o con una contraseña inutilizable ("!..."), igual se paga el costo de un
            # hash: así esas cuentas no responden más rápido y no se delatan (misma mitigación que
            # usa el ModelBackend de Django).
            make_password(raw_password)
            return False
        return check_password(raw_password, password_hash)

    def needs_rehash(self, password_hash: str) -> bool:
        if not is_password_usable(password_hash):
            return False
        preferred = get_hasher()
        return identify_hasher(password_hash).algorithm != preferred.algorithm or (
            preferred.must_update(password_hash)
        )

    def rehash(self, raw_password: str) -> str:
        return make_password(raw_password)
