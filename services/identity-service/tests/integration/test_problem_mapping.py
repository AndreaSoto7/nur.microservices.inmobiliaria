from identity.domain.errors import DomainError
from identity.presentation.exception_handler import DOMAIN_ERRORS


def _all_subclasses(cls: type) -> set[type]:
    direct = set(cls.__subclasses__())
    return direct | {sub for child in direct for sub in _all_subclasses(child)}


def test_every_domain_error_has_an_http_status():
    # Si alguien agrega un error de dominio y olvida mapearlo, este test falla en vez de
    # responder un status equivocado en producción.
    assert _all_subclasses(DomainError) <= set(DOMAIN_ERRORS)
