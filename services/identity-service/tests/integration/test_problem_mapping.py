from identity.domain.errors import DomainError
from identity.presentation.exception_handler import DOMAIN_ERRORS


def _all_subclasses(cls: type) -> set[type]:
    direct = set(cls.__subclasses__())
    return direct | {sub for child in direct for sub in _all_subclasses(child)}


def test_cada_error_de_dominio_tiene_status_http_asignado():
    # Si alguien agrega un error de dominio y olvida mapearlo, este test falla en vez de
    # responder un status equivocado en producción.
    assert _all_subclasses(DomainError) <= set(DOMAIN_ERRORS)
