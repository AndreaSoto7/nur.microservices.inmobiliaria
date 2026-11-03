"""El OpenAPI de contracts/ es la fuente de verdad: sus operaciones deben existir en el servicio."""

from pathlib import Path

import pytest
import yaml
from django.urls import Resolver404, resolve

CONTRACT = Path(__file__).resolve().parents[4] / "contracts/openapi/identity-service.yaml"
# Operaciones del contrato que todavía no se implementan. Se quitan al implementarlas.
NOT_IMPLEMENTED_YET = {"refreshTokens"}


def operations() -> list[tuple[str, str, str]]:
    spec = yaml.safe_load(CONTRACT.read_text())
    return [
        (path, method, operation["operationId"])
        for path, methods in spec["paths"].items()
        for method, operation in methods.items()
        if method in {"get", "post", "put", "patch", "delete"}
    ]


@pytest.mark.parametrize(("path", "method", "operation_id"), operations())
def test_cada_operacion_del_contrato_tiene_su_ruta(path, method, operation_id):
    if operation_id in NOT_IMPLEMENTED_YET:
        pytest.skip("Pendiente de implementar")
    try:
        match = resolve(path)
    except Resolver404:
        pytest.fail(f"{operation_id}: {method.upper()} {path} no existe en el servicio")

    view_class = getattr(match.func, "view_class", None)
    if view_class is not None:  # las vistas de health son funciones con require_GET
        assert hasattr(view_class, method), f"{operation_id}: la vista no acepta {method}"
