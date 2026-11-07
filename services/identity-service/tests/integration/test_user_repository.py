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


def test_saves_the_user_and_finds_it_by_email():
    repository = DjangoUserRepository()

    repository.add(a_user())

    assert repository.exists_with_email(Email("ANA@example.com")) is True
    assert repository.exists_with_email(Email("otro@example.com")) is False


def test_duplicate_email_raises_domain_error():
    repository = DjangoUserRepository()
    repository.add(a_user())

    with pytest.raises(EmailAlreadyRegistered):
        repository.add(a_user())


def test_other_integrity_violation_is_not_disguised_as_duplicate_email(monkeypatch):
    def broken_to_model(user):
        model = to_model(user)
        model.full_name = None  # NOT NULL
        return model

    monkeypatch.setattr(repositories, "to_model", broken_to_model)

    with pytest.raises(IntegrityError):
        DjangoUserRepository().add(a_user())


def test_mapper_round_trip_keeps_all_fields():
    user = a_user()

    restored = to_domain(to_model(user))

    assert restored == user
    assert restored.email == user.email
    assert restored.full_name == user.full_name
    assert restored.password_hash == user.password_hash
    assert restored.roles == user.roles
    assert restored.is_active == user.is_active
    assert restored.registered_at == user.registered_at


def test_finds_by_email_and_rebuilds_the_aggregate():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    found = repository.get_by_email(Email("ANA@example.com"))

    assert found == user
    assert found.roles == frozenset({Role.AGENT})
    assert found.password_hash == "pbkdf2_sha256$hash"


def test_finding_an_unknown_email_returns_none():
    assert DjangoUserRepository().get_by_email(Email("nadie@example.com")) is None


def test_finds_by_id():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    assert repository.get_by_id(user.id) == user
    assert repository.get_by_id(uuid4()) is None


def test_ledger_marks_a_token_used_only_once():
    ledger = DjangoRefreshTokenLedger()
    token = a_refresh_token()

    assert ledger.mark_used(token) is True
    assert ledger.mark_used(token) is False


def test_ledger_revokes_a_family_idempotently():
    ledger = DjangoRefreshTokenLedger()
    family_id = uuid4()

    assert ledger.is_family_revoked(family_id) is False
    ledger.revoke_family(family_id, NOW)
    ledger.revoke_family(family_id, NOW)

    assert ledger.is_family_revoked(family_id) is True


def test_updates_only_the_password_hash():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    repository.update_password_hash(
        user.with_password_hash("nuevo-hash"), previous_hash=user.password_hash
    )

    stored = repository.get_by_id(user.id)
    assert stored.password_hash == "nuevo-hash"
    assert stored.full_name == user.full_name


def test_rehash_does_not_overwrite_a_password_changed_meanwhile():
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    repository.update_password_hash(
        user.with_password_hash("hash-de-la-contrasena-vieja"), previous_hash="otro-hash"
    )

    assert repository.get_by_id(user.id).password_hash == user.password_hash


def test_failure_saving_the_rehash_neither_raises_nor_logs_the_hash(monkeypatch, caplog):
    repository = DjangoUserRepository()
    user = a_user()
    repository.add(user)

    def broken(**kwargs):
        raise DatabaseError("sin base")

    monkeypatch.setattr(repositories.UserModel.objects, "filter", broken)

    repository.update_password_hash(user.with_password_hash("hash-secreto"), previous_hash="x")

    assert "actualizar el hash" in caplog.text
    assert "hash-secreto" not in caplog.text
