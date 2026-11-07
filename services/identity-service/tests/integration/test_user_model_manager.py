"""El manager solo lo usan los comandos de Django, pero no crea filas que el dominio rechace."""

import pytest

from identity.domain.errors import InvalidEmail, InvalidFullName
from identity.infrastructure.persistence.mappers import to_domain
from identity.infrastructure.persistence.models import UserModel

pytestmark = pytest.mark.django_db


def test_creates_a_user_the_domain_can_load():
    model = UserModel.objects.create_user("Ana@Example.com", "S3gura-2026", full_name="Ana")

    user = to_domain(model)

    assert user.email.value == "ana@example.com"
    assert [role.value for role in user.roles] == ["CLIENT"]
    assert model.check_password("S3gura-2026")


def test_create_superuser_creates_an_admin():
    model = UserModel.objects.create_superuser("root@example.com", "S3gura-2026", full_name="Root")

    assert model.roles == ["ADMIN"]


def test_rejects_an_email_the_domain_does_not_accept():
    with pytest.raises(InvalidEmail):
        UserModel.objects.create_user("ana@localhost", "S3gura-2026", full_name="Ana")


def test_rejects_a_user_without_name():
    with pytest.raises(InvalidFullName):
        UserModel.objects.create_user("ana@example.com", "S3gura-2026")
