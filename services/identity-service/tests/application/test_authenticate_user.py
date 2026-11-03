import dataclasses

import pytest

from identity.application.commands.register_user import RegisterUserCommand, RegisterUserHandler
from identity.application.dto import TokenPair
from identity.application.queries.authenticate_user import (
    AuthenticateUserHandler,
    AuthenticateUserQuery,
)
from identity.domain.errors import InvalidCredentials
from tests.application.fakes import (
    FakePasswordHasher,
    FakeTokenIssuer,
    FixedClock,
    InMemoryUserRepository,
)

PASSWORD = "S3gura-2026"


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture
def user_id(users, hasher):
    register = RegisterUserHandler(users=users, password_hasher=hasher, clock=FixedClock())
    return register.handle(
        RegisterUserCommand(email="ana@example.com", password=PASSWORD, full_name="Ana Pérez")
    )


@pytest.fixture
def handler(users, hasher) -> AuthenticateUserHandler:
    return AuthenticateUserHandler(
        users=users, password_hasher=hasher, token_issuer=FakeTokenIssuer()
    )


def test_con_credenciales_validas_devuelve_el_par_de_tokens(handler, user_id):
    tokens = handler.handle(AuthenticateUserQuery(email="ana@example.com", password=PASSWORD))

    assert tokens == TokenPair(
        access_token=f"access-for-{user_id}",
        refresh_token=f"refresh-for-{user_id}",
        expires_in=900,
    )
    assert tokens.token_type == "Bearer"


def test_el_email_no_distingue_mayusculas(handler, user_id):
    tokens = handler.handle(AuthenticateUserQuery(email="ANA@Example.com", password=PASSWORD))

    assert tokens.access_token == f"access-for-{user_id}"


def test_contrasena_incorrecta_da_credenciales_invalidas(handler, user_id):
    with pytest.raises(InvalidCredentials) as error:
        handler.handle(AuthenticateUserQuery(email="ana@example.com", password="otra-clave"))

    assert error.value.code == "AUTH_INVALID_CREDENTIALS"


def test_email_inexistente_da_el_mismo_error_y_mensaje(handler, user_id):
    with pytest.raises(InvalidCredentials) as wrong_password:
        handler.handle(AuthenticateUserQuery(email="ana@example.com", password="otra-clave"))
    with pytest.raises(InvalidCredentials) as unknown_email:
        handler.handle(AuthenticateUserQuery(email="nadie@example.com", password=PASSWORD))

    assert unknown_email.value.message == wrong_password.value.message


def test_email_inexistente_igual_verifica_una_contrasena_para_no_revelarlo_por_tiempo(
    handler, hasher, user_id
):
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserQuery(email="nadie@example.com", password=PASSWORD))

    assert hasher.verify_calls == 1


def test_email_con_formato_invalido_da_credenciales_invalidas(handler):
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserQuery(email="no-es-un-email", password=PASSWORD))


def test_un_usuario_inactivo_no_obtiene_tokens(handler, users, user_id):
    users.users["ana@example.com"] = dataclasses.replace(
        users.users["ana@example.com"], is_active=False
    )

    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserQuery(email="ana@example.com", password=PASSWORD))


def test_no_aplica_la_politica_de_contrasenas_al_login(handler, user_id):
    # Una contraseña corta no es "débil" en el login: simplemente no coincide.
    with pytest.raises(InvalidCredentials):
        handler.handle(AuthenticateUserQuery(email="ana@example.com", password="x"))


def test_la_consulta_no_muestra_la_contrasena_en_repr():
    assert PASSWORD not in repr(AuthenticateUserQuery(email="a@b.com", password=PASSWORD))
