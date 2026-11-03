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
- **JWT:** se emiten con **PyJWT** (`PyJWT[crypto]`), detrás del puerto `TokenIssuer`.
  - No se usa `djangorestframework-simplejwt`, porque no pone `kid` en el header y el JWKS lo necesita para elegir la clave. Además identity solo emite tokens y no los valida con DRF.
  - La clave privada RS256 sale de `JWT_PRIVATE_KEY_PATH` (archivo montado) o de `JWT_PRIVATE_KEY`. El `kid` es la huella RFC 7638 de la clave.
  - Endpoint JWKS: `GET /api/v1/auth/.well-known/jwks.json`.
  - Claims del access token: `sub`, `email`, `roles`, `iss`, `aud=inmobiliaria`, `iat`, `exp` y `jti`. El header lleva `typ=at+jwt`.
  - El refresh token usa `aud=identity-service` y `typ=rt+jwt`: ningún otro servicio lo acepta.
- **JSON en camelCase:** `djangorestframework-camel-case` (parser y renderer) en `REST_FRAMEWORK`.
- **Errores:** `EXCEPTION_HANDLER` propio que devuelve `application/problem+json` (ver la rule `api-rest`).
- **OpenAPI:** la fuente de verdad es `contracts/openapi/identity-service.yaml`, que **se edita a mano** (contract-first) y nunca se sobrescribe. `drf-spectacular` solo alimenta Swagger UI en `/docs`. Un test de contrato comprueba que las operaciones del YAML existan.
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
- **Con `runserver`** (desarrollo) no se registra. Así el autoreload no duplica registros.
- **En el contenedor** el registro se repite en un hilo del proceso maestro, y `graceful_timeout` deja margen frente a los 10 s de `docker stop`.
- **Workers:** `gthread`, para que dos clientes lentos no bloqueen todo el servicio.
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
