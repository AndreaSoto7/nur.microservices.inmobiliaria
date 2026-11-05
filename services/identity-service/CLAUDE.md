# identity-service — Django + DRF

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica. Si algo de aquí no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | @Tiesol |
| Stack | Django 5.2 LTS + Django REST Framework, Python 3.13 |
| Puerto | 8001 (solo dentro de Docker; en el host con `infra/docker-compose.debug.yml`) |
| Base | `identity` (PostgreSQL 17) → [`docs/base-de-datos/identity-service.md`](../../docs/base-de-datos/identity-service.md) |
| API | [`contracts/openapi/identity-service.yaml`](../../contracts/openapi/identity-service.yaml) · Swagger UI en `/docs` |
| Rutas del gateway | `/api/v1/auth/**`, `/api/v1/users/**` |
| Publica | `identity.user.events` |
| Consume | Nada |
| Progreso | [`docs/progreso/identity-service.md`](../../docs/progreso/identity-service.md) |
| Guía para personas | [`README.md`](README.md): correr en local, JWT, limpieza periódica |

## Qué hace y qué no

- **Hace:** registro, login, refresh y logout, `GET /users/me`, roles y emisión de JWT RS256 con JWKS.
- **No hace:** validar permisos de dominio de otros servicios (cada uno valida el token con el JWKS) ni guardar datos de propiedades o visitas.

## Dominio

- **Aggregate `User`** (`identity/domain/user.py`): inmutable. Value objects `Email`, `FullName`, `RawPassword`; `Role` (`CLIENT`, `AGENT`, `ADMIN`).
- **Invariantes:** email único y válido (máx. 254, en minúsculas); contraseña de 8 a 128 caracteres; al menos un rol; por registro público solo `CLIENT` (por defecto) o `AGENT`, nunca `ADMIN`.
- **Refresh tokens:** no son un aggregate; son un registro técnico (`used_refresh_tokens`, `revoked_refresh_families`).

## Casos de uso (event storming → código)

| Diagrama | Código | Regla | Evento |
|---|---|---|---|
| `registerUserCommand` | `RegisterUserCommand` ✅ | Email único; contraseña ≥ 8; rol inicial `CLIENT` | `UserRegistered` ✅ |
| `loginCommand` | `AuthenticateUserCommand` ✅ | Credenciales válidas; sin enumeración de emails | `UserLoggedIn` (solo si se construye audit-service) |
| `assignRoleCommand` | `AssignUserRolesCommand` (pendiente) | Solo `ADMIN`; roles válidos | `UserRolesAssigned` (solo si se construye audit-service) |
| — | `RefreshTokensCommand` ✅, `LogoutCommand` ✅, `GetCurrentUserQuery` ✅ | Rotación por familia; tope de 30 días | — |

✅ = implementado.

## Eventos

- **Publica** en `identity.user.events` con outbox (misma transacción que el usuario) y el relay `python manage.py run_outbox_relay`.
- `UserRegistered` lleva email y nombre: por eso el topic usa la retención por defecto. Los eventos opcionales para auditoría no llevan email ni nombre.
- Schema: `contracts/events/identity/user-registered.v1.schema.json`.

## Estructura

```
config/                 settings (base, dev, test), urls, wsgi, gunicorn.conf.py
identity/
  domain/               User, Email, FullName, Role, errores, UserRepository (ABC), eventos
  application/          commands/, queries/, puertos (PasswordHasher, TokenIssuer, EventPublisher, Clock)
  infrastructure/
    persistence/        models.py (ORM), repositories, mappers, migrations/, management commands
    messaging/          eventos de integración, outbox relay, productor Kafka
    security/           hash de contraseñas, emisión y verificación de JWT, JWKS
    discovery/          registro y baja en Consul
    observability.py    logs JSON con correlationId
  presentation/         views (DRF), serializers, urls, exception handler, middlewares, /health
tests/  domain/ application/ integration/
```

El **modelo de Django es persistencia** (`infrastructure/persistence/models.py`); el dominio es Python puro. Las views solo validan con serializers y llaman a un handler.

## Decisiones técnicas

- **Usuario propio desde el día 1:** `AUTH_USER_MODEL` con PK UUID en `infrastructure/persistence`.
- **JWT con PyJWT** detrás del puerto `TokenIssuer`. No se usa `djangorestframework-simplejwt`: no pone `kid` en el header.
  - Clave privada desde `JWT_PRIVATE_KEY_PATH` (o `JWT_PRIVATE_KEY`). `kid` = huella RFC 7638.
  - JWKS: `GET /api/v1/auth/.well-known/jwks.json`.
  - Access token: `sub`, `email`, `roles`, `iss`, `aud=inmobiliaria`, `iat`, `exp`, `jti`; header `typ=at+jwt`.
  - Refresh token: `aud=identity-service` y `typ=rt+jwt`, para que ningún otro servicio lo acepte.
- **camelCase:** `djangorestframework-camel-case` (parser y renderer).
- **Errores:** `EXCEPTION_HANDLER` propio → `application/problem+json`.
- **OpenAPI:** el YAML de `contracts/` se edita a mano (contract-first). `drf-spectacular` solo alimenta `/docs`. Un test de contrato comprueba que las operaciones del YAML existan.
- **Configuración:** `django-environ`. `DEBUG=False` por defecto; secretos solo desde el entorno.
- **Kafka:** `confluent-kafka`.

## Registro en Consul

Sigue la rule `service-discovery`.

- `register()` y `deregister()` en `identity/infrastructure/discovery/consul.py`.
- **Con gunicorn**, una sola vez por contenedor: hook `when_ready` → registro; `on_exit` → baja (en `config/gunicorn.conf.py`). El registro se repite cada 60 s en un hilo del proceso maestro.
- **Con `runserver`** no se registra (el autoreload duplicaría registros).
- Workers `gthread`. IP con `socket.gethostbyname(socket.gethostname())`, salvo `SERVICE_ADDRESS`.
- `GET /health` y `GET /health/ready` fuera de `/api/v1`.

## Migraciones

- Solo el responsable genera migraciones (`makemigrations` en su rama) y commitea el archivo.
- Nunca edites una migración que ya está en `main`.
- Si dos ramas generaron migraciones en paralelo: tras el rebase, `python manage.py makemigrations --merge`.

## Comandos

```bash
python -m venv .venv                 # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 8001
pytest
ruff check . && ruff format .
python manage.py run_outbox_relay    # relay del outbox
python manage.py run_maintenance     # limpieza periódica (--once para una vez)
```

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `ddd-clean-architecture`, `api-rest`, `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`. Si tocas mensajería, también `eventos-kafka`.
- **Skills:** `/caso-de-uso` (por ejemplo, `AssignUserRolesCommand`), `/nuevo-endpoint`, `/nuevo-evento` (eventos opcionales de auditoría), `/revisar`, `/crear-pr`.
- **Agente revisor:** `revisor-seguridad` para auth, tokens y configuración; `arquitecto-ddd` para dominio.

## Pendiente

- `AssignUserRolesCommand` (solo `ADMIN`).
- Si se construye audit-service: publicar `UserLoggedIn` y `UserRolesAssigned` (sin email ni nombre).
- Antes de exponer identity: rate limit de login y registro en el gateway.
