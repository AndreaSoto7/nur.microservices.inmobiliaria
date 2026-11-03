"""La configuración de JWT se valida al arrancar: un error de configuración no pasa callado."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parents[2]


def load_settings(**env: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-c", "import django; django.setup()"],
        cwd=SERVICE_DIR,
        env=os.environ | {"DJANGO_SETTINGS_MODULE": "config.settings.test"} | env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_la_configuracion_por_defecto_es_valida():
    assert load_settings().returncode == 0


@pytest.mark.parametrize(
    "env",
    [
        {"JWT_ACCESS_TTL_SECONDS": "86400"},
        {"JWT_ACCESS_TTL_SECONDS": "0"},
        {"JWT_REFRESH_TTL_SECONDS": "600"},
        {"JWT_ISSUER": ""},
        {"JWT_AUDIENCE": ""},
    ],
)
def test_rechaza_configuraciones_de_jwt_peligrosas(env):
    result = load_settings(**env)

    assert result.returncode != 0
    assert "ImproperlyConfigured" in result.stderr
