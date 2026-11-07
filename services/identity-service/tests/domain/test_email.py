import pytest

from identity.domain.email import Email
from identity.domain.errors import InvalidEmail


def test_normalizes_to_lowercase_without_spaces():
    email = Email("  Ana.Perez@Example.COM ")

    assert email.value == "ana.perez@example.com"


def test_two_emails_with_different_casing_are_equal():
    assert Email("ana@example.com") == Email("ANA@example.com")


@pytest.mark.parametrize("raw", ["", "sin-arroba.com", "ana@", "ana@dominio", "ana perez@x.com"])
def test_rejects_malformed_emails(raw):
    with pytest.raises(InvalidEmail) as error:
        Email(raw)

    assert error.value.code == "USER_INVALID_EMAIL"


def test_rejects_emails_longer_than_254_characters():
    with pytest.raises(InvalidEmail):
        Email("a" * 250 + "@x.com")
