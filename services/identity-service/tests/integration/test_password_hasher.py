from django.contrib.auth.hashers import make_password

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
