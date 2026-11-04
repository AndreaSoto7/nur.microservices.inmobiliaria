"""El OpenAPI de contracts/ es la fuente de verdad: sus operaciones deben existir en el servicio."""

from pathlib import Path

import pytest
import yaml
from django.urls import Resolver404, resolve

CONTRACT = Path(__file__).resolve().parents[4] / "contracts/openapi/identity-service.yaml"
# Operaciones del contrato que todavía no se implementan. Se quitan al implementarlas.
NOT_IMPLEMENTED_YET = {"logout", "getCurrentUser"}


def operations() -> list[tuple[str, str, str]]:
    spec = yaml.safe_load(CONTRACT.read_text())
    return [
        (path, method, operation["operationId"])
        for path, methods in spec["paths"].items()
        for method, operation in methods.items()
        if method in {"get", "post", "put", "patch", "delete"}
    ]


def a_case(path: str, method: str, operation_id: str):
    # strict: si alguien implementa la operación y no la saca de la lista, el test falla.
    marks = pytest.mark.xfail(strict=True) if operation_id in NOT_IMPLEMENTED_YET else ()
    return pytest.param(path, method, operation_id, marks=marks)


@pytest.mark.parametrize(("path", "method", "operation_id"), [a_case(*op) for op in operations()])
def test_cada_operacion_del_contrato_tiene_su_ruta(path, method, operation_id):
    try:
        match = resolve(path)
    except Resolver404:
        pytest.fail(f"{operation_id}: {method.upper()} {path} no existe en el servicio")

    view_class = getattr(match.func, "view_class", None)
    if view_class is not None:  # las vistas de health son funciones con require_GET
        assert hasattr(view_class, method), f"{operation_id}: la vista no acepta {method}"
