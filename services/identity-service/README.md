# identity-service

Registro, autenticación, usuarios y roles. Emite los JWT RS256 que validan el gateway y el resto de servicios con el JWKS.

- **Stack:** Django 5.2 LTS + Django REST Framework, Python 3.13.
- **Puerto:** 8001, solo dentro de la red de Docker. Se publica en el host únicamente con `infra/docker-compose.debug.yml`.
- **Contrato:** [`contracts/openapi/identity-service.yaml`](../../contracts/openapi/identity-service.yaml). Swagger UI en `/docs`.
- **Instrucciones para agentes:** [`CLAUDE.md`](CLAUDE.md) (dominio, casos de uso, decisiones técnicas y comandos).

## Estructura

```
config/                       settings (base, dev, test), urls, wsgi, gunicorn.conf.py
identity/
  domain/                     modelo de dominio en Python puro (value objects, errores)
  application/                casos de uso y puertos
  infrastructure/
    persistence/              modelos de Django, repositorios, migraciones y comando del relay
    messaging/                eventos de integración, relay del outbox y productor Kafka
    security/                 hash de contraseñas, emisión y verificación de JWT
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

**Evento de dominio:** `UserRegistered` (se publica en Kafka con el outbox; ver [Eventos](#eventos)).

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
| `POST /api/v1/auth/refresh` | Canjea un refresh token por un par nuevo |
| `POST /api/v1/auth/logout` | Cierra la sesión del refresh token. Responde 204 |
| `GET /api/v1/users/me` | Datos del usuario autenticado (requiere access token) |
| `GET /api/v1/auth/.well-known/jwks.json` | Clave pública para validar los tokens (cacheable 5 min) |

- **Access token** (15 min): `sub`, `email`, `roles`, `iss=identity-service`, `aud=inmobiliaria`, `iat`, `exp`, `jti`, `tokenType=access`. Header con `alg=RS256`, `kid` y `typ=at+jwt` (RFC 9068).
- **Cómo lo validan el gateway y los servicios:** firma con el JWKS, `iss=identity-service`, `aud=inmobiliaria`, `exp` y `typ=at+jwt`.
- **Refresh token** (7 días): solo `sub`, `iss`, `iat`, `exp`, `jti` y `tokenType=refresh`, con `fid`, `auth_time`, `aud=identity-service` y `typ=rt+jwt`. Por eso **ningún otro servicio lo acepta como access token**.
- **Cerrar sesión:** `POST /api/v1/auth/logout` revoca la familia del refresh token. Los access tokens ya emitidos siguen valiendo hasta su `exp`, porque los servicios los validan sin consultar a identity.
- **Rotación:** `POST /api/v1/auth/refresh` canjea el refresh token por un par nuevo, y cada uno sirve una sola vez. Si se reutiliza (señal de robo), se revoca toda su familia. Los tokens usados se guardan en `used_refresh_tokens` y las familias revocadas en `revoked_refresh_families`.
- **Tope de sesión:** cada rotación renueva 7 días, pero nunca pasa de 30 días desde el login (`auth_time`). Después hay que volver a iniciar sesión. El access token de la última rotación puede pasar el tope hasta 15 min, y se acepta: es su duración normal.
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

- **Produce:** `UserRegistered` en `identity.user.events`. El evento se guarda en la tabla `outbox`, en la misma transacción que el usuario, y el proceso `python manage.py run_outbox_relay` lo publica en Kafka.
- **Consume:** ninguno.

## Limpieza periódica

El proceso `python manage.py run_maintenance` corre cada hora y borra lo que ya no sirve. Con `--once` limpia una vez y termina.

| Tabla | Se borra cuando |
|---|---|
| `used_refresh_tokens` | El token venció hace más de 1 h |
| `revoked_refresh_families` | Pasaron 30 días y 1 h desde la revocación: ya no puede quedar un token vivo de esa familia |
| `outbox` | El evento se publicó hace más de 7 días. Un evento pendiente nunca se borra |

**Si bajas `JWT_SESSION_MAX_SECONDS`:** primero espera a que venzan los refresh tokens ya emitidos (hasta el tope anterior). Si no, la limpieza podría borrar una familia revocada que todavía tiene tokens vivos, y esos tokens volverían a servir.
