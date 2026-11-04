from django.contrib.auth.hashers import PBKDF2PasswordHasher, make_password

from identity.infrastructure.security import password_hasher
from identity.infrastructure.security.password_hasher import DjangoPasswordHasher


def count_hash_work(monkeypatch) -> list[str]:
    calls: list[str] = []
    original = password_hasher.make_password

    def counting(raw, *args, **kwargs):
        calls.append(raw)
        return original(raw, *args, **kwargs)

    monkeypatch.setattr(password_hasher, "make_password", counting)
    return calls


def test_verifica_una_contrasena_correcta():
    hasher = DjangoPasswordHasher()

    assert hasher.verify("S3gura-2026", make_password("S3gura-2026")) is True


def test_sin_usuario_igual_paga_el_costo_de_un_hash(monkeypatch):
    calls = count_hash_work(monkeypatch)

    assert DjangoPasswordHasher().verify("x", None) is False
    assert calls == ["x"]


def test_con_una_contrasena_inutilizable_igual_paga_el_costo_de_un_hash(monkeypatch):
    # Un hash que empieza con "!" (createsuperuser sin contraseña) haría responder al instante
    # y delataría que la cuenta existe.
    unusable = make_password(None)
    calls = count_hash_work(monkeypatch)

    assert DjangoPasswordHasher().verify("x", unusable) is False
    assert calls == ["x"]


PBKDF2_FIRST = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.MD5PasswordHasher",
]


def test_un_hash_con_otro_algoritmo_necesita_actualizarse(settings):
    old = make_password("S3gura-2026")  # MD5 en los tests
    settings.PASSWORD_HASHERS = PBKDF2_FIRST

    assert DjangoPasswordHasher().needs_rehash(old) is True
    assert DjangoPasswordHasher().needs_rehash(make_password("S3gura-2026")) is False


def test_un_hash_con_menos_iteraciones_necesita_actualizarse(settings):
    settings.PASSWORD_HASHERS = PBKDF2_FIRST
    weak = PBKDF2PasswordHasher().encode("S3gura-2026", "salsalsalsal", iterations=1000)

    assert DjangoPasswordHasher().needs_rehash(weak) is True


def test_un_hash_inutilizable_no_se_actualiza():
    assert DjangoPasswordHasher().needs_rehash(make_password(None)) is False


def test_rehash_genera_un_hash_valido():
    hasher = DjangoPasswordHasher()

    assert hasher.verify("S3gura-2026", hasher.rehash("S3gura-2026")) is True
