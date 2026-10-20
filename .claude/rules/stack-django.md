---
paths:
  - "services/identity-service/**"
---

# identity-service — Django + Django REST Framework

## Estructura

```
services/identity-service/
  manage.py
  config/                 # settings (base, dev, test), urls, wsgi/asgi
  identity/
    domain/               # User (dataclass pura), Email, Role, errores, UserRepository (ABC), eventos
    application/          # commands/ queries/ handlers, puertos (PasswordHasher, TokenIssuer, EventPublisher)
    infrastructure/
      persistence/        # models.py (Django ORM), repositories, mappers, migrations/
      messaging/          # outbox + productor Kafka
      security/           # emisión JWT RS256, JWKS
      discovery/          # registro y baja en Consul (rule service-discovery)
    presentation/         # views (DRF APIView/ViewSet), serializers, urls, exception handler, /health
  tests/  domain/ application/ integration/
  requirements.txt  requirements-dev.txt  .env.example  Dockerfile
```

Django tiende a MVC/MTV. Aquí el **modelo de Django es persistencia** (`infrastructure/persistence/models.py`) y el dominio es Python puro. Los views de DRF solo validan con serializers y llaman a un handler.

## Decisiones técnicas

- **Usuario propio desde el día 1:** `AUTH_USER_MODEL` con PK UUID, en `infrastructure/persistence`. Cambiarlo después de migrar es muy costoso.
- **JWT:** `djangorestframework-simplejwt` configurado con `ALGORITHM="RS256"`, `SIGNING_KEY` y `VERIFYING_KEY` leídos del entorno.
  - Endpoint JWKS: `GET /api/v1/auth/.well-known/jwks.json`.
  - Claims extra: `roles`, `email`.
- **JSON en camelCase:** `djangorestframework-camel-case` (parser y renderer) en `REST_FRAMEWORK`.
- **Errores:** `EXCEPTION_HANDLER` propio que devuelve `application/problem+json` (ver la rule `api-rest`).
- **OpenAPI:** `drf-spectacular`. Se exporta a `contracts/openapi/identity-service.yaml` y Swagger UI queda en `/docs`.
- **Configuración:** `django-environ`. `DEBUG=False` por defecto; `SECRET_KEY` y credenciales solo desde el entorno.
- **Kafka:** `confluent-kafka`. El relay de outbox corre como management command (`python manage.py run_outbox_relay`).
- **Eventos que produce:** `UserRegistered` en `identity.user.events`.

## Registro en Consul

Sigue el contrato de la rule `service-discovery`.

- Las funciones `register()` y `deregister()` viven en `identity/infrastructure/discovery/consul.py` y hacen el `PUT` con `urllib.request` o `httpx`.
- **Con gunicorn** (contenedor), el registro va **una sola vez por contenedor**, no una vez por worker:
  - Hook `when_ready` → registro.
  - Hook `on_exit` → baja.
  - Los dos hooks van en `config/gunicorn.conf.py`.
- **Con `runserver`** (desarrollo) no se registra, salvo que se active con una variable de entorno. Así el autoreload no duplica registros.
- **IP del contenedor:** `socket.gethostbyname(socket.gethostname())`, salvo que `SERVICE_ADDRESS` venga lleno.
- **Health:** `GET /health` y `GET /health/ready` en `presentation/`, fuera del prefijo `/api/v1`.

## Migraciones (evitar conflictos)

- Solo el responsable de identity genera migraciones. Hazlo con `makemigrations` en tu rama y commitea el archivo generado.
- Nunca edites una migración que ya está en `main`. Crea una nueva.
- Si dos ramas generaron migraciones en paralelo: después del rebase, `python manage.py makemigrations --merge`.

## Comandos

```bash
python -m venv .venv          # activar: .venv\Scripts\activate (Windows) o source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 8001
pytest
ruff check . && ruff format .
```
