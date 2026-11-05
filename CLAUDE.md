# Plataforma Inmobiliaria — Microservicios (Ingeniería Web 3 · Proyecto 06)

Plataforma donde agentes publican casas y departamentos (venta o alquiler) y los interesados buscan con filtros, guardan favoritos, envían consultas y solicitan visitas. Resumen del enunciado y criterios de evaluación: `docs/enunciado.md`. Decisiones de arquitectura: `docs/adr/`.

## Servicios y responsables

| Servicio | Stack | Responsable | Puerto | Base de datos | Responsabilidad |
|---|---|---|---|---|---|
| `identity-service` | Django + DRF | @Tiesol | 8001 | PostgreSQL | Registro, login, usuarios, roles, emisión de JWT |
| `listing-service` | Spring Boot | _(completar)_ | 8002 | PostgreSQL | Propiedades, galería, características, estados y favoritos. Catálogo público con filtros (lado query). Reserva la propiedad cuando una oportunidad se gana (`LeadClosed`) |
| `visit-service` | NestJS | _(completar)_ | 8003 | PostgreSQL | Consultas, oportunidades (`Lead`), solicitudes y programación de visitas, seguimiento. Rechaza o cancela visitas cuando la propiedad se reserva, vende o alquila |
| `audit-service` | por decidir | _(completar)_ | 8004 | por decidir | **Opcional** (ADR 0005): registro de solo inserción de todos los eventos, consultable por `ADMIN` |
| `gateway` | Go (propio) | @Tiesol | 8080 | — | Único punto de entrada: ruteo, JWT, CORS, rate limit, balanceo de carga y cliente de service discovery |
| `frontend` | React + Vite + TypeScript | _(completar)_ | 5173 | — | UI para interesados y agentes |
| Kafka (KRaft) | — | — | 9092 · UI 8090 | — | Bus de eventos entre servicios |
| Consul (modo dev) | — | — | UI 8500 | — | Service discovery: registro de servicios y health checks |

**Puertos en el host** (ADR 0002):
- **Uso normal y demo** (`infra/docker-compose.yml`): solo se publican el gateway (8080) y el frontend (5173), más la UI de Consul (8500) y la UI de Kafka (8090) **solo en `127.0.0.1`**. Los servicios usan su puerto **dentro de la red de Docker** y se descubren por Consul. Así se pueden escalar con `--scale`.
- **Depuración** (`infra/docker-compose.debug.yml`): se publican además, **solo en `127.0.0.1`**, los servicios (8001–8005), los PostgreSQL (5433–5437, uno por servicio, para no chocar con un Postgres local en 5432) y Kafka (9092). Este override no se combina con `--scale`.
- **Ningún servicio usa `container_name`**, porque impide escalar.

**Service discovery** (ADR 0002): cada servicio se registra solo en Consul al arrancar:
- Lo hace con la IP de su contenedor y un ID único por réplica (`<servicio>-<hostname>`).
- Expone `GET /health`, que Consul revisa cada 10 s.
- El gateway reparte las requests entre las réplicas sanas (round robin).

## Estructura del monorepo

```
contracts/
  events/          # JSON Schema de cada evento Kafka (fuente de verdad)
  openapi/         # OpenAPI 3.1 de cada servicio (fuente de verdad)
services/
  identity-service/  listing-service/  visit-service/
  audit-service/     # opcional (ADR 0005)
gateway/   frontend/
infra/             # docker-compose, Kafka, bases de datos
docs/              # enunciado, ADRs, patrones de diseño, esquemas de base de datos (docs/base-de-datos/), progreso por servicio (docs/progreso/)
.claude/           # rules, skills y agents compartidos del equipo
```

## Reglas de oro (no negociables)

1. **Cada servicio es dueño de sus datos.** Nunca leer ni escribir la base de datos de otro servicio. No se comparten tablas ni modelos de dominio entre servicios.
2. **Los servicios se comunican por eventos en Kafka.** El cliente entra solo por el API Gateway. Una llamada HTTP síncrona entre servicios solo se permite si un ADR la justifica.
3. **Contract-first.** Todo cambio de API o de evento va primero en `contracts/`, en su propio PR, y se implementa después. Nunca se rompe un contrato publicado: se versiona.
4. **Arquitectura limpia en cada servicio.** Dependencias hacia adentro: `presentation`/`infrastructure` → `application` → `domain`. El dominio no importa frameworks (ni ORM, ni HTTP, ni Kafka).
5. **CQRS.** Los comandos cambian estado y no devuelven datos de lectura. Las consultas no cambian estado. El catálogo público es el lado query de listing, con su propia proyección de lectura, y la copia de propiedades en visit es un modelo de lectura alimentado por eventos (ADR 0005).
6. **Patrones justificados.** Cada patrón de diseño aplicado se registra en `docs/patrones-de-diseno.md`, con el problema que resuelve y el archivo donde está.
7. **Solo tocas tu servicio.** Para cambiar el de otra persona, coordina con su responsable (issue o PR revisado por esa persona). Las zonas compartidas (`contracts/`, `infra/`, `docs/adr/`, `.claude/`, `CLAUDE.md`) requieren PR revisado por al menos otra persona y aviso al grupo.
8. **Cero secretos en git.** `.env` nunca se sube. `.env.example` sí, y se actualiza con cada variable nueva.
9. **KISS y YAGNI.** Primero el alcance obligatorio del enunciado. Los extras (comparar, recomendaciones, métricas) van después.

## Convenciones globales

- **Idioma:** código, endpoints, eventos, tablas y columnas en inglés. Documentación, PRs, issues y la descripción de los commits en español.
- **IDs:** UUID como string, generados por el dominio. Nunca se exponen IDs autoincrementales.
- **Fechas:** ISO-8601 en UTC (`2026-10-16T14:30:00Z`).
- **Dinero:** `{ "amount": 125000.00, "currency": "BOB" }`. La plataforma maneja una sola moneda, **BOB**. En el dominio nunca se usa float (BigDecimal, Decimal o enteros en centavos).
- **JSON:** camelCase en todas las APIs y eventos (en Django se configura un renderer camelCase). Los enums van en `UPPER_SNAKE_CASE`.
- **Errores HTTP:** RFC 9457 `application/problem+json` (ver la rule `api-rest`).
- **Auth:**
  - identity emite un JWT RS256 de 15 min, con refresh token.
  - Claims: `sub` (UUID del usuario), `email`, `roles`, `iss=identity-service` y `aud=inmobiliaria`.
  - Roles: `CLIENT`, `AGENT`, `ADMIN`.
  - Cada servicio valida firma, `exp`, `iss`, `aud` y el header `typ=at+jwt` con el JWKS de identity.
  - El gateway valida antes, como defensa temprana: reenvía `Authorization` intacto y borra cualquier `X-User-*` que llegue del cliente.
- **Trazabilidad:** el header `X-Correlation-Id` se propaga en HTTP y en los eventos. Los logs son JSON estructurado y no llevan datos personales ni tokens.

## Lenguaje ubicuo

| Español | En código | Valores / notas |
|---|---|---|
| Propiedad | `Property` | Aggregate root en listing. En el event storming le dijimos "Listing": es lo mismo; en código siempre `Property`. |
| Tipo de inmueble | `PropertyType` | `HOUSE`, `APARTMENT` |
| Operación | `OperationType` | `SALE`, `RENT` |
| Estado de publicación | `PropertyStatus` | `DRAFT`, `PUBLISHED`, `PAUSED`, `RESERVED`, `SOLD`, `RENTED` |
| Característica | `Feature` | `GARAGE`, `GARDEN`, `POOL`, `COMMON_AREAS`, … |
| Ubicación / zona | `Location` | `zone`, `address`, coordenadas simuladas |
| Agente | `Agent` | Usuario con rol `AGENT` |
| Consulta | `Inquiry` | Mensaje de un interesado sobre una propiedad |
| Interesado / oportunidad | `Lead` | Seguimiento comercial de un cliente con una propiedad. Se abre con la primera consulta o solicitud de visita. En el event storming: "oportunidad". |
| Resultado de la oportunidad | `LeadOutcome` | `WON`, `LOST`. Una oportunidad `WON` reserva la propiedad (ADR 0005). |
| Visita | `Visit` | `REQUESTED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`, `REJECTED`. En el event storming, "programada" = `SCHEDULED`, "rechazada" = `REJECTED`, "concluida" = `COMPLETED`. |
| Quién actúa | `Actor` | `CLIENT`, `AGENT`, `SYSTEM`. `SYSTEM` es una política que reacciona a un evento. |
| Favorito | `Favorite` | Propiedad guardada por un usuario. Aggregate propio en listing, separado de `Property` (ADR 0003). |

Tabla completa de comandos y eventos del event storming con su nombre en código: [ADR 0005](docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md), sección 2.

## Flujo de trabajo Git

- `main` está protegida: solo entra código por PR, con 1 aprobación y **squash merge**.
- **Otra persona aprueba y el autor mergea su propio PR.** Nadie mergea PRs ajenos. Todo PR tiene base `main`, sin encadenar. Guía paso a paso: [`docs/flujo-de-revision.md`](docs/flujo-de-revision.md).
- **Ramas:** `<tipo>/<scope>-<descripcion-corta>`, por ejemplo `feat/listing-publicar-propiedad` o `fix/visit-validar-fecha`.
- **Commits:** Conventional Commits, `tipo(scope): descripción en español`.
  - Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`.
  - Scopes: `identity`, `listing`, `visit`, `audit`, `gateway`, `frontend`, `contracts`, `infra`, `docs`, `claude`.
- **Antes de subir:** `git fetch origin` y `git rebase origin/main`. En tu propia rama usa `git push --force-with-lease`. Nunca hagas force push a `main` ni a ramas ajenas.
- **PRs chicos** (idealmente menos de 400 líneas), de un solo servicio, usando la plantilla de `.github/`.
- **Lockfiles:** se commitean (`package-lock.json`, `go.sum`, `requirements*.txt`, wrapper de Maven). No reformatees archivos que no tocaste.

## Definition of Done

- [ ] Compila y pasa lint y formato en el servicio tocado.
- [ ] Hay tests de dominio y de aplicación para la lógica nueva, y pasan.
- [ ] El contrato (OpenAPI o evento) está actualizado y coincide con la implementación.
- [ ] No hay secretos, y `.env.example` está al día.
- [ ] Si se usó un patrón de diseño, está registrado en `docs/patrones-de-diseno.md`.
- [ ] `docs/progreso/<servicio>.md` está actualizado: una fila en el historial (feat o fix y su PR) y los pendientes tachados o agregados.
- [ ] El PR tiene la plantilla completa y una revisión aprobada.

## Cómo trabajar con Claude en este repo

**Rules:** las de `.claude/rules/` se cargan solas cuando Claude toca archivos de su área (DDD, REST, eventos, SOLID, patrones, seguridad, testing, un stack o el frontend).

**Skills** (escribe `/nombre`):

| Skill | Para qué sirve |
|---|---|
| `/iniciar-tarea` | Crear la rama correcta, sincronizar con `main` y planificar |
| `/scaffold-servicio` | Esqueleto inicial de un microservicio según su stack |
| `/caso-de-uso` | Implementar un comando o una consulta con DDD + CQRS |
| `/nuevo-endpoint` | Endpoint REST contract-first (OpenAPI → código → tests) |
| `/nuevo-evento` | Definir o cambiar un evento Kafka (schema, productor, consumidores) |
| `/aplicar-patron` | Elegir, implementar y justificar un patrón de diseño |
| `/componente-front` | Componentes Smart/Dumb en el frontend |
| `/revisar` | Autorrevisión antes del PR (lanza los agentes revisores) |
| `/crear-pr` | Commit, rebase y PR con la plantilla |
| `/resolver-conflicto` | Resolver conflictos de merge o rebase sin perder trabajo |
| `/adr` | Registrar una decisión de arquitectura |

**Agentes:** `revisor-seguridad`, `guardian-contratos` y `arquitecto-ddd`. Las revisiones de API REST y frontend son checklists dentro de `/revisar`.

- **Un solo agente por PR, el del riesgo principal.** Cada agente parte de cero y consume muchos tokens: una auditoría con pruebas puede gastar más de 100.000.
- **`arquitecto-ddd` y `guardian-contratos` corren con Sonnet** (`model: sonnet` en su archivo). `revisor-seguridad` usa el modelo de la sesión.
- **Alcance:** que revisen el diff; ejecutar pruebas solo si hace falta.

**Lecciones (ya nos pasaron):**

- **Todo PR tiene base `main`.** Un PR con base en otra rama queda "Merged" sin llegar a `main`: GitHub no avisa, y así se perdieron de `main` el registro y el login (#9 a #11, recuperados en #13 a #15). Si un trabajo depende de otro, el segundo se abre recién cuando el primero está en `main`.
- **Después de mergear, verifica que el cambio esté en `main`.** Un merge justo después de un push puede fallar porque GitHub todavía calcula si es mergeable.
- **`git add` por ruta, nunca `git add -A` sobre una carpeta:** así se coló un archivo local en un PR. Además, un archivo local que entra a una rama desaparece de tu carpeta al cambiar de rama.
- **No reformatees JSON con un script:** infla el diff. Edita solo la línea que cambia.

**Preferencias personales:** van en `CLAUDE.local.md` y `.claude/settings.local.json`. Los dos están en `.gitignore`.

## Decisiones pendientes (registrar en `docs/adr/` cuando se tomen)

- Stack, base de datos y responsable de audit-service, si se construye (ADR 0005).
- Versiones exactas de cada stack.
- Linter y formateador de Java en listing-service (Spotless o Checkstyle).
- Librerías de router y de datos del frontend (se completan en el ADR 0004).

Ya decididas: gateway en Go con Consul ([0002](docs/adr/0002-gateway-go-balanceador-consul.md)), Favoritos en listing ([0003](docs/adr/0003-favoritos-en-listing.md)), frontend en React ([0004](docs/adr/0004-frontend-react.md)) y servicios realineados al event storming, sin search ni notification y con cadenas de eventos entre listing y visit ([0005](docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md)).

## Comandos

Cuando exista `infra/`:

- **Infraestructura:** `docker compose -f infra/docker-compose.yml up -d`.
- **Demo de balanceo:** `docker compose -f infra/docker-compose.yml up -d --scale listing-service=3`.
- **Depuración con puertos publicados:** `docker compose -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d`.
- **Por servicio:** ver la rule del stack correspondiente en `.claude/rules/stack-*.md`.
