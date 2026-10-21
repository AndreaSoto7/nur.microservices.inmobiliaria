import pytest

from identity.domain.email import Email
from identity.domain.errors import InvalidEmail


def test_normaliza_a_minusculas_y_sin_espacios():
    email = Email("  Ana.Perez@Example.COM ")

    assert email.value == "ana.perez@example.com"


def test_dos_emails_con_distinta_capitalizacion_son_iguales():
    assert Email("ana@example.com") == Email("ANA@example.com")


@pytest.mark.parametrize("raw", ["", "sin-arroba.com", "ana@", "ana@dominio", "ana perez@x.com"])
def test_rechaza_emails_mal_formados(raw):
    with pytest.raises(InvalidEmail) as error:
        Email(raw)

    assert error.value.code == "USER_INVALID_EMAIL"


def test_rechaza_emails_de_mas_de_254_caracteres():
    with pytest.raises(InvalidEmail):
        Email("a" * 250 + "@x.com")
