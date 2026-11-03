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
python manage.py migrate
python manage.py runserver 8001
```

Con `runserver` no se registra en Consul (`CONSUL_ENABLED=false`). En el contenedor, gunicorn registra la réplica al arrancar y la da de baja al apagarse.

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
