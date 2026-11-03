import pytest

from identity.application.commands.register_user import RegisterUserCommand, RegisterUserHandler
from identity.domain.errors import (
    EmailAlreadyRegistered,
    InvalidFullName,
    RoleNotAllowed,
    WeakPassword,
)
from identity.domain.full_name import FullName
from identity.domain.role import Role
from tests.application.fakes import FakePasswordHasher, FixedClock, InMemoryUserRepository


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture
def handler(users, hasher) -> RegisterUserHandler:
    return RegisterUserHandler(users=users, password_hasher=hasher, clock=FixedClock())


def a_command(**overrides) -> RegisterUserCommand:
    data = {
        "email": "Ana.Perez@Example.com",
        "password": "S3gura-2026",
        "full_name": "Ana Pérez",
    }
    return RegisterUserCommand(**(data | overrides))


def test_guarda_el_usuario_con_la_contrasena_hasheada_y_devuelve_su_id(handler, users):
    user_id = handler.handle(a_command())

    saved = users.users["ana.perez@example.com"]
    assert saved.id == user_id
    assert saved.password_hash == "hashed::S3gura-2026"
    assert saved.full_name == FullName("Ana Pérez")


def test_sin_rol_usa_el_rol_por_defecto_client(handler, users):
    handler.handle(a_command(role=None))

    assert users.users["ana.perez@example.com"].roles == frozenset({Role.CLIENT})


def test_permite_registrarse_como_agente(handler, users):
    handler.handle(a_command(role="AGENT"))

    assert users.users["ana.perez@example.com"].roles == frozenset({Role.AGENT})


def test_rechaza_un_email_ya_registrado_sin_importar_mayusculas(handler, users):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered) as error:
        handler.handle(a_command(email="ANA.PEREZ@example.com"))

    assert error.value.code == "USER_EMAIL_ALREADY_REGISTERED"
    assert len(users.users) == 1


def test_el_error_de_email_repetido_no_incluye_el_email(handler):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered) as error:
        handler.handle(a_command())

    assert "ana.perez@example.com" not in error.value.message.lower()


def test_no_guarda_nada_si_la_contrasena_es_debil(handler, users):
    with pytest.raises(WeakPassword):
        handler.handle(a_command(password="corta"))

    assert users.users == {}


def test_no_permite_autoasignarse_admin(handler, users):
    with pytest.raises(RoleNotAllowed):
        handler.handle(a_command(role="ADMIN"))

    assert users.users == {}


@pytest.mark.parametrize(
    "overrides",
    [{"full_name": "   "}, {"role": "ADMIN"}, {"role": "FOO"}, {"password": "corta"}],
)
def test_no_hashea_si_los_datos_son_invalidos(handler, hasher, overrides):
    # Hashear con PBKDF2 es caro: los datos inválidos no deben gastar CPU.
    with pytest.raises((InvalidFullName, RoleNotAllowed, WeakPassword)):
        handler.handle(a_command(**overrides))

    assert hasher.calls == 0


def test_no_hashea_si_el_email_ya_existe(handler, hasher):
    handler.handle(a_command())

    with pytest.raises(EmailAlreadyRegistered):
        handler.handle(a_command())

    assert hasher.calls == 1
