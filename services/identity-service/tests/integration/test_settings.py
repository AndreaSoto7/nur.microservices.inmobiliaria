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


def test_default_configuration_is_valid():
    assert load_settings().returncode == 0


@pytest.mark.parametrize(
    "env",
    [
        {"JWT_ACCESS_TTL_SECONDS": "86400"},
        {"JWT_ACCESS_TTL_SECONDS": "0"},
        {"JWT_REFRESH_TTL_SECONDS": "600"},
        {"JWT_SESSION_MAX_SECONDS": "3600"},
        {"MAINTENANCE_INTERVAL_SECONDS": "0"},
        {"OUTBOX_RETENTION_SECONDS": "-1"},
        {"JWT_ISSUER": ""},
        {"JWT_AUDIENCE": ""},
    ],
)
def test_rejects_dangerous_jwt_configurations(env):
    result = load_settings(**env)

    assert result.returncode != 0
    assert "ImproperlyConfigured" in result.stderr


def test_service_address_is_included_in_allowed_hosts():
    # Consul llama a http://<SERVICE_ADDRESS>:8001/health. Sin esto, el check da 400.
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import django; django.setup(); from django.conf import settings; "
            "print('10.9.9.9' in settings.ALLOWED_HOSTS)",
        ],
        cwd=SERVICE_DIR,
        env=os.environ
        | {"DJANGO_SETTINGS_MODULE": "config.settings.test"}
        | {"SERVICE_ADDRESS": "10.9.9.9"},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.stdout.strip().endswith("True")
