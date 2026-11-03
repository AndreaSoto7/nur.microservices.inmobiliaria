import dataclasses
from datetime import UTC, datetime

import pytest

from identity.domain.email import Email
from identity.domain.errors import (
    InvalidCredentials,
    InvalidFullName,
    RoleNotAllowed,
    WeakPassword,
)
from identity.domain.events import UserRegistered
from identity.domain.full_name import FullName
from identity.domain.password import RawPassword
from identity.domain.role import DEFAULT_SELF_REGISTRATION_ROLE, Role, self_registration_role
from identity.domain.user import User

NOW = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


def register(role: Role = Role.CLIENT) -> User:
    return User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="hash-de-prueba",
        role=role,
        now=NOW,
    )


def test_registra_un_usuario_activo_con_su_rol():
    user = register(role=Role.AGENT)

    assert user.email == Email("ana@example.com")
    assert user.full_name == FullName("Ana Pérez")
    assert user.password_hash == "hash-de-prueba"
    assert user.roles == frozenset({Role.AGENT})
    assert user.is_active is True
    assert user.registered_at == NOW


def test_genera_un_id_distinto_por_usuario():
    assert register().id != register().id


def test_registrar_emite_user_registered():
    user = register()

    events = user.pull_events()

    assert events == [
        UserRegistered(
            user_id=user.id,
            email="ana@example.com",
            full_name="Ana Pérez",
            roles=("CLIENT",),
            occurred_at=NOW,
        )
    ]


def test_pull_events_vacia_la_lista():
    user = register()
    user.pull_events()

    assert user.pull_events() == []


def test_no_permite_registrarse_como_admin():
    with pytest.raises(RoleNotAllowed) as error:
        register(role=Role.ADMIN)

    assert error.value.code == "USER_ROLE_NOT_ALLOWED"


def test_no_se_pueden_cambiar_los_roles_desde_afuera():
    user = register()

    with pytest.raises(dataclasses.FrozenInstanceError):
        user.roles = frozenset({Role.ADMIN})


def test_un_usuario_siempre_tiene_al_menos_un_rol():
    # Es una invariante, no un error de negocio: si pasa, es un bug o un dato corrupto (500).
    with pytest.raises(ValueError):
        User(
            id=register().id,
            email=Email("ana@example.com"),
            full_name=FullName("Ana Pérez"),
            password_hash="x",
            roles=frozenset(),
            is_active=True,
            registered_at=NOW,
        )


def test_el_hash_de_la_contrasena_no_aparece_en_repr():
    assert "hash-de-prueba" not in repr(register())


def test_dos_usuarios_son_iguales_si_tienen_el_mismo_id():
    user = register()

    assert user == User(
        id=user.id,
        email=Email("otro@example.com"),
        full_name=FullName("Otro"),
        password_hash="x",
        roles=frozenset({Role.CLIENT}),
        is_active=True,
        registered_at=NOW,
    )


def test_el_rol_por_defecto_del_autorregistro_es_client():
    assert DEFAULT_SELF_REGISTRATION_ROLE is Role.CLIENT


def test_role_parse_acepta_el_nombre_del_rol():
    assert Role.parse("AGENT") is Role.AGENT


def test_role_parse_rechaza_roles_desconocidos_con_el_texto_del_contrato():
    with pytest.raises(RoleNotAllowed) as error:
        Role.parse("SUPERUSER")

    assert error.value.message == "Solo se puede registrar con rol CLIENT o AGENT."


def test_full_name_recorta_espacios():
    assert FullName("  Ana Pérez  ").value == "Ana Pérez"


@pytest.mark.parametrize("raw", ["", "   ", "x" * 151])
def test_full_name_rechaza_nombres_vacios_o_demasiado_largos(raw):
    with pytest.raises(InvalidFullName) as error:
        FullName(raw)

    assert error.value.code == "USER_INVALID_FULL_NAME"


@pytest.mark.parametrize("raw", ["corta", "x" * 129, "x" * 5000])
def test_rechaza_contrasenas_fuera_de_8_a_128_caracteres(raw):
    with pytest.raises(WeakPassword) as error:
        RawPassword(raw)

    assert error.value.code == "USER_WEAK_PASSWORD"


def test_la_contrasena_no_aparece_en_repr():
    assert "S3gura-2026" not in repr(RawPassword("S3gura-2026"))


@pytest.mark.parametrize("value", [None, ""])
def test_sin_rol_el_autorregistro_usa_client(value):
    assert self_registration_role(value) is Role.CLIENT


def test_el_autorregistro_acepta_agent():
    assert self_registration_role("AGENT") is Role.AGENT


@pytest.mark.parametrize("value", ["ADMIN", "FOO"])
def test_el_autorregistro_rechaza_admin_y_roles_desconocidos(value):
    with pytest.raises(RoleNotAllowed):
        self_registration_role(value)


def test_un_usuario_activo_puede_autenticarse():
    register().ensure_can_authenticate()


def test_un_usuario_inactivo_no_puede_autenticarse():
    user = register()
    inactive = dataclasses.replace(user, is_active=False)

    with pytest.raises(InvalidCredentials) as error:
        inactive.ensure_can_authenticate()

    assert error.value.code == "AUTH_INVALID_CREDENTIALS"
