# identity-service

Registro, autenticación, usuarios y roles. Emite los JWT RS256 que validan el gateway y el resto de servicios con el JWKS.

- **Stack:** Django 5.2 LTS + Django REST Framework, Python 3.13.
- **Puerto:** 8001, solo dentro de la red de Docker. Se publica en el host únicamente con `infra/docker-compose.debug.yml`.
- **Contrato:** [`contracts/openapi/identity-service.yaml`](../../contracts/openapi/identity-service.yaml). Swagger UI en `/docs`.
- **Rules:** `.claude/rules/stack-django.md`, `ddd-clean-architecture.md` y `service-discovery.md`.

## Estructura

```
config/                       settings (base, dev, test), urls, wsgi, gunicorn.conf.py
identity/
  domain/                     modelo de dominio en Python puro (value objects, errores)
  application/                casos de uso y puertos
  infrastructure/
    persistence/              modelo de Django (UserModel), migraciones
    discovery/                registro y baja en Consul
    observability.py          logs JSON con correlationId
  presentation/               health, middlewares, errores problem+json, urls
tests/  domain/  application/  integration/
```

## Modelo de dominio y de datos

Primero se modela el dominio. La base de datos se deriva de él, y solo este servicio la lee y la escribe (regla de oro 1).

**Agregado `User`** (`identity/domain/user.py`): inmutable. Los cambios de estado futuros serán métodos del agregado que validen sus reglas.

| Campo | Tipo de dominio | Reglas |
|---|---|---|
| `id` | `UUID` | Lo genera el dominio al registrar |
| `email` | `Email` (value object) | Formato válido, máximo 254, normalizado a minúsculas, único |
| `full_name` | `FullName` (value object) | Entre 1 y 150 caracteres, sin espacios en los extremos |
| `password_hash` | `str` | Hash del puerto `PasswordHasher`. La contraseña en texto plano (`RawPassword`, de 8 a 128 caracteres) nunca se guarda |
| `roles` | `frozenset[Role]` | Al menos uno. `CLIENT`, `AGENT` o `ADMIN`; por registro público solo `CLIENT` (por defecto) o `AGENT` |
| `is_active` | `bool` | `True` al registrarse |
| `registered_at` | `datetime` (UTC) | Lo da el puerto `Clock` |

**Evento de dominio:** `UserRegistered` (se publicará en Kafka con el outbox).

**Tabla `users`** (PostgreSQL, `identity/infrastructure/persistence/models.py`)

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` | PK |
| `email` | `varchar(254)` | `UNIQUE` (cubre la carrera entre dos registros simultáneos) |
| `full_name` | `varchar(150)` | `NOT NULL` |
| `password` | `varchar(128)` | Hash de Django (PBKDF2) |
| `roles` | `jsonb` | Lista de roles |
| `is_active` | `boolean` | |
| `date_joined` | `timestamptz` | |
| `last_login` | `timestamptz` | Nulo (heredado de `AbstractBaseUser`) |

Las tablas de `django.contrib.auth` y `contenttypes` existen porque Django las necesita para `AUTH_USER_MODEL`, pero el dominio no las usa.

## Correr en local

```bash
cd services/identity-service
uv venv --python 3.13 .venv          # o: python3.13 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
uv pip install -r requirements-dev.txt   # o: pip install -r requirements-dev.txt
cp .env.example .env                 # y ajusta DATABASE_URL
mkdir -p keys && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/jwt-private.pem
python manage.py migrate
python manage.py runserver 8001
```

Con `runserver` no se registra en Consul. En el contenedor, un hilo de gunicorn registra la réplica, repite el registro cada 60 s (Consul en modo dev guarda todo en memoria) y la da de baja al apagarse. Si Consul no responde, el servicio arranca igual.

## Tests, lint y formato

```bash
pytest                 # SQLite en memoria; exporta DATABASE_URL para usar PostgreSQL
ruff check .
ruff format .
```

## Docker

```bash
docker build -t identity-service .
```

Al arrancar, el contenedor aplica las migraciones y levanta gunicorn en el puerto 8001.

## Autenticación (JWT RS256)

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/auth/register` | Crea un usuario `CLIENT` (por defecto) o `AGENT`. Responde `201 { id }` |
| `POST /api/v1/auth/login` | Valida credenciales y devuelve `{ accessToken, refreshToken, tokenType, expiresIn }`, con `Cache-Control: no-store` |
| `GET /api/v1/auth/.well-known/jwks.json` | Clave pública para validar los tokens (cacheable 5 min) |

- **Access token** (15 min): `sub`, `email`, `roles`, `iss=identity-service`, `aud=inmobiliaria`, `iat`, `exp`, `jti`, `tokenType=access`. Header con `alg=RS256`, `kid` y `typ=at+jwt` (RFC 9068).
- **Cómo lo validan el gateway y los servicios:** firma con el JWKS, `iss=identity-service`, `aud=inmobiliaria`, `exp` y `typ=at+jwt`.
- **Refresh token** (7 días): solo `sub`, `iss`, `iat`, `exp`, `jti` y `tokenType=refresh`, con `aud=identity-service` y `typ=rt+jwt`. Por eso **ningún otro servicio lo acepta como access token**. El endpoint para usarlo llega en otro PR.
- **`kid`**: huella RFC 7638 de la clave pública. Si se rota la clave, cambia el `kid`, y el gateway y los servicios saben que deben volver a pedir el JWKS.
- **Clave privada**: solo la tiene identity (`JWT_PRIVATE_KEY_PATH`). Sin clave, `/health/ready` responde `DOWN`.
- **Rotar la clave**: exige reiniciar identity, y los tokens firmados con la clave anterior dejan de validar (hasta 15 min los access y 7 días los refresh). Publicar varias claves en el JWKS se agrega solo si hace falta (YAGNI).
- **Login**: un email inexistente, una contraseña incorrecta y un usuario inactivo dan el mismo `401 AUTH_INVALID_CREDENTIALS`, y tardan lo mismo (se verifica contra un hash ficticio). Así no se puede averiguar qué emails existen.

## Variables de entorno

Ver [`.env.example`](.env.example).

## Dependencias

Las directas están en `requirements.in` y `requirements-dev.in`. Los `.txt` son el lockfile y se regeneran con:

```bash
uv pip compile requirements.in -o requirements.txt --python-version 3.13
uv pip compile requirements-dev.in -o requirements-dev.txt --python-version 3.13
```

## Eventos

- **Produce:** `UserRegistered` en `identity.user.events` (pendiente: outbox).
- **Consume:** ninguno.
