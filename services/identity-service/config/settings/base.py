"""Configuración común a todos los entornos.

Todo lo sensible o lo que cambia entre entornos sale de variables de entorno (ver `.env.example`).
Es la configuración que usa el contenedor (`DJANGO_SETTINGS_MODULE=config.settings.base`).
"""

import socket
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

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
    # Si se registra en Consul con otra dirección (depuración), el check llega con ese Host.
    *([address] if (address := env.str("SERVICE_ADDRESS", default="")) else []),
]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "drf_spectacular",
    "identity.infrastructure.persistence.apps.PersistenceConfig",
]

# Swagger UI (/docs) necesita las plantillas de drf_spectacular.
TEMPLATES = [
    {"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True},
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

# JWT RS256. La clave privada nunca va en git: o su contenido PEM en JWT_PRIVATE_KEY (con \n
# escapado), o la ruta a un archivo montado en JWT_PRIVATE_KEY_PATH. Los demás validan con el JWKS.
JWT_PRIVATE_KEY = env.str("JWT_PRIVATE_KEY", default="", multiline=True)
JWT_PRIVATE_KEY_PATH = env.str("JWT_PRIVATE_KEY_PATH", default="")
JWT_ISSUER = env.str("JWT_ISSUER", default="identity-service")
JWT_AUDIENCE = env.str("JWT_AUDIENCE", default="inmobiliaria")
JWT_ACCESS_TTL_SECONDS = env.int("JWT_ACCESS_TTL_SECONDS", default=15 * 60)
JWT_REFRESH_TTL_SECONDS = env.int("JWT_REFRESH_TTL_SECONDS", default=7 * 24 * 60 * 60)

# Un error de configuración aquí anularía las garantías de los tokens: mejor no arrancar.
if not 60 <= JWT_ACCESS_TTL_SECONDS <= 3600:
    raise ImproperlyConfigured("JWT_ACCESS_TTL_SECONDS debe estar entre 60 y 3600.")
if JWT_REFRESH_TTL_SECONDS <= JWT_ACCESS_TTL_SECONDS:
    raise ImproperlyConfigured("JWT_REFRESH_TTL_SECONDS debe ser mayor que el del access token.")
if not JWT_ISSUER or not JWT_AUDIENCE:
    raise ImproperlyConfigured("JWT_ISSUER y JWT_AUDIENCE no pueden estar vacíos.")

LANGUAGE_CODE = "es"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["djangorestframework_camel_case.render.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["djangorestframework_camel_case.parser.CamelCaseJSONParser"],
    # Sin autenticación global: cada vista protegida declara BearerAuthentication.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    # Mínimo privilegio: por defecto se deniega. Los endpoints públicos declaran AllowAny.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "identity.presentation.exception_handler.problem_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "OAS_VERSION": "3.1.0",
    "TITLE": "identity-service",
    "VERSION": "1.1.1",
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
