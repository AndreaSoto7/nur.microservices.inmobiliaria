"""Configuración común a todos los entornos.

Todo lo sensible o lo que cambia entre entornos sale de variables de entorno (ver `.env.example`).
Es la configuración que usa el contenedor (`DJANGO_SETTINGS_MODULE=config.settings.base`).
"""

import socket
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# En local se lee `.env`. No pisa variables que ya existan, y en la imagen de Docker no hay `.env`.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env.str("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)

SERVICE_NAME = env.str("SERVICE_NAME", default="identity-service")


def _container_hosts() -> list[str]:
    # Consul y el gateway llaman al servicio por la IP de su contenedor, que cambia en cada
    # arranque. Django rechaza (400) cualquier Host que no esté en ALLOWED_HOSTS.
    hostname = socket.gethostname()
    try:
        return [hostname, socket.gethostbyname(hostname)]
    except OSError:
        return [hostname]


ALLOWED_HOSTS = [
    *env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]),
    SERVICE_NAME,
    *_container_hosts(),
]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "drf_spectacular",
    "identity.infrastructure.persistence.apps.PersistenceConfig",
]

MIDDLEWARE = [
    "identity.presentation.middleware.CorrelationIdMiddleware",
    "identity.presentation.middleware.RequestLoggingMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Usuario propio con PK UUID desde el día 1 (rule stack-django).
AUTH_USER_MODEL = "identity.UserModel"

LANGUAGE_CODE = "es"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["djangorestframework_camel_case.render.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["djangorestframework_camel_case.parser.CamelCaseJSONParser"],
    # identity no recibe JWT: sus endpoints son públicos (registro, login, JWKS).
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "identity.presentation.exception_handler.problem_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "identity-service",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields",
    ],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "correlation_id": {"()": "identity.infrastructure.observability.CorrelationIdFilter"},
    },
    "formatters": {
        "json": {"()": "identity.infrastructure.observability.JsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["correlation_id"],
        },
    },
    "root": {"handlers": ["console"], "level": env.str("LOG_LEVEL", default="INFO")},
    "loggers": {
        # Ya logueamos cada request en RequestLoggingMiddleware.
        "django.server": {"level": "WARNING"},
    },
}
