from datetime import UTC, datetime
from uuid import uuid4

import pytest
from django.db import DatabaseError, IntegrityError

from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from identity.infrastructure.persistence import repositories
from identity.infrastructure.persistence.mappers import to_domain, to_model
from identity.infrastructure.persistence.repositories import (
    DjangoRefreshTokenLedger,
    DjangoUserRepository,
)
from tests.application.fakes import a_refresh_token

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


def a_user(email: str = "ana@example.com") -> User:
    return User.register(
        email=Email(email),
        full_name=FullName("Ana Pérez"),
        password_hash="pbkdf2_sha256$hash",
        role=Role.AGENT,
        now=NOW,
    )


def test_guarda_el_usuario_y_lo_encuentra_por_email():
    repository = DjangoUserRepository()

    repository.add(a_user())

    assert repository.exists_with_email(Email("ANA@example.com")) is True
    assert repository.exists_with_email(Email("otro@example.com")) is False


def test_un_email_repetido_lanza_error_de_dominio():
    repository = DjangoUserRepository()
    repository.add(a_user())

    with pytest.raises(EmailAlreadyRegistered):
        repository.add(a_user())


def test_otra_violacion_de_integridad_no_se_disfraza_de_email_repetido(monkeypatch):
    def broken_to_model(user):
        model = to_model(user)
        model.full_name = None  # NOT NULL
        return model

    monkeypatch.setattr(repositories, "to_model", broken_to_model)

    with pytest.raises(IntegrityError):
        DjangoUserRepository().add(a_user())


def test_el_mapper_ida_y_vuelta_conserva_todos_los_campos():
    user = a_user()

    restored = to_domain(to_model(user))

    assert restored == user
    assert restored.email == user.email
    assert restored.full_name == user.full_name
    assert restored.password_hash == user.password_hash
    assert restored.roles == user.roles
    assert restored.is_active == user.is_active
    assert restored.registered_at == user.registered_at


def test_busca_por_email_y_reconstruye_el_agregado():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    found = repository.get_by_email(Email("ANA@example.com"))

    assert found == user
    assert found.roles == frozenset({Role.AGENT})
    assert found.password_hash == "pbkdf2_sha256$hash"


def test_buscar_un_email_inexistente_devuelve_none():
    assert DjangoUserRepository().get_by_email(Email("nadie@example.com")) is None


def test_busca_por_id():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    assert repository.get_by_id(user.id) == user
    assert repository.get_by_id(uuid4()) is None


def test_el_ledger_marca_un_token_usado_una_sola_vez():
    ledger = DjangoRefreshTokenLedger()
    token = a_refresh_token()

    assert ledger.mark_used(token) is True
    assert ledger.mark_used(token) is False


def test_el_ledger_revoca_una_familia_de_forma_idempotente():
    ledger = DjangoRefreshTokenLedger()
    family_id = uuid4()

    assert ledger.is_family_revoked(family_id) is False
    ledger.revoke_family(family_id, NOW)
    ledger.revoke_family(family_id, NOW)

    assert ledger.is_family_revoked(family_id) is True


def test_actualiza_solo_el_hash_de_la_contrasena():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    repository.update_password_hash(
        user.with_password_hash("nuevo-hash"), previous_hash=user.password_hash
    )

    stored = repository.get_by_id(user.id)
    assert stored.password_hash == "nuevo-hash"
    assert stored.full_name == user.full_name


def test_el_rehash_no_pisa_una_contrasena_que_cambio_mientras_tanto():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    repository.update_password_hash(
        user.with_password_hash("hash-de-la-contrasena-vieja"), previous_hash="otro-hash"
    )

    assert repository.get_by_id(user.id).password_hash == user.password_hash


def test_una_falla_al_guardar_el_rehash_no_lanza_error_ni_loguea_el_hash(monkeypatch, caplog):
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    def broken(**kwargs):
        raise DatabaseError("sin base")

    monkeypatch.setattr(repositories.UserModel.objects, "filter", broken)

    repository.update_password_hash(user.with_password_hash("hash-secreto"), previous_hash="x")

    assert "actualizar el hash" in caplog.text
    assert "hash-secreto" not in caplog.text
