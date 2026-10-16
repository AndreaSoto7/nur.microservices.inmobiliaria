# Plataforma Inmobiliaria — Microservicios (Ingeniería Web 3 · Proyecto 06)

Plataforma donde agentes publican casas y departamentos (venta o alquiler) y los interesados buscan con filtros, guardan favoritos, envían consultas y solicitan visitas. Resumen del enunciado y criterios de evaluación: `docs/enunciado.md`. Decisiones de arquitectura: `docs/adr/`.

## Servicios y responsables

| Servicio | Stack | Responsable | Puerto | Base de datos | Responsabilidad |
|---|---|---|---|---|---|
| `identity-service` | Django + DRF | _(completar)_ | 8001 | PostgreSQL | Registro, login, usuarios, roles, emisión de JWT |
| `listing-service` | Spring Boot | _(completar)_ | 8002 | PostgreSQL | Propiedades, galería, características, estados (lado comando) |
| `visit-service` | NestJS | _(completar)_ | 8003 | PostgreSQL | Consultas, leads, solicitudes y programación de visitas, seguimiento |
| `search-service` | Go | _(completar)_ | 8004 | por decidir (ADR) | Catálogo de solo lectura con filtros (lado query de CQRS) |
| `notification-service` | Go | _(completar)_ | 8005 | por decidir (ADR) | Avisos ante solicitudes, visitas y cambios de estado |
| `gateway` | por decidir (ADR) | _(completar)_ | 8080 | — | Único punto de entrada, JWT, CORS, rate limit |
| `frontend` | por decidir (ADR) | _(completar)_ | 4200 | — | UI para interesados y agentes |
| Kafka (KRaft) | — | — | 9092 · UI 8090 | — | Bus de eventos entre servicios |

Puertos de PostgreSQL en el host: 5433 a 5437 (uno por servicio), para no chocar con un Postgres local en 5432.

## Estructura del monorepo

```
contracts/
  events/          # JSON Schema de cada evento Kafka (fuente de verdad)
  openapi/         # OpenAPI 3.1 de cada servicio (fuente de verdad)
services/
  identity-service/  listing-service/  visit-service/
  search-service/    notification-service/
gateway/   frontend/
infra/             # docker-compose, Kafka, bases de datos
docs/              # enunciado, ADRs, registro de patrones de diseño
.claude/           # rules, skills y agents compartidos del equipo
```

## Reglas de oro (no negociables)

1. **Cada servicio es dueño de sus datos.** Nunca leer ni escribir la base de datos de otro servicio. No se comparten tablas ni modelos de dominio entre servicios.
2. **Los servicios se comunican por eventos en Kafka.** El cliente entra solo por el API Gateway. Una llamada HTTP síncrona entre servicios solo se permite si un ADR la justifica.
3. **Contract-first.** Todo cambio de API o de evento va primero en `contracts/`, en su propio PR, y se implementa después. Nunca se rompe un contrato publicado: se versiona.
4. **Arquitectura limpia en cada servicio.** Dependencias hacia adentro: `presentation`/`infrastructure` → `application` → `domain`. El dominio no importa frameworks (ni ORM, ni HTTP, ni Kafka).
5. **CQRS.** Los comandos cambian estado y no devuelven datos de lectura. Las consultas no cambian estado. `search-service` es el modelo de lectura del catálogo.
6. **Patrones justificados.** Cada patrón de diseño aplicado se registra en `docs/patrones-de-diseno.md`, con el problema que resuelve y el archivo donde está.
7. **Solo tocas tu servicio.** Para cambiar el de otra persona, coordina con su responsable (issue o PR revisado por esa persona). Las zonas compartidas (`contracts/`, `infra/`, `docs/adr/`, `.claude/`, `CLAUDE.md`) requieren PR revisado por al menos otra persona y aviso al grupo.
8. **Cero secretos en git.** `.env` nunca se sube. `.env.example` sí, y se actualiza con cada variable nueva.
9. **KISS y YAGNI.** Primero el alcance obligatorio del enunciado. Los extras (comparar, recomendaciones, métricas) van después.

## Convenciones globales

- **Idioma:** código, endpoints, eventos, tablas y columnas en inglés. Documentación, PRs, issues y la descripción de los commits en español.
- **IDs:** UUID como string, generados por el dominio. Nunca se exponen IDs autoincrementales.
- **Fechas:** ISO-8601 en UTC (`2026-10-16T14:30:00Z`).
- **Dinero:** `{ "amount": 125000.00, "currency": "USD" }`. En el dominio nunca se usa float (BigDecimal, Decimal o enteros en centavos).
- **JSON:** camelCase en todas las APIs y eventos (en Django se configura un renderer camelCase). Los enums van en `UPPER_SNAKE_CASE`.
- **Errores HTTP:** RFC 9457 `application/problem+json` (ver la rule `api-rest`).
- **Auth:** identity emite un JWT RS256 con los claims `sub`, `email` y `roles`. Roles: `CLIENT`, `AGENT`, `ADMIN`. Cada servicio valida el token con el JWKS de identity.
- **Trazabilidad:** el header `X-Correlation-Id` se propaga en HTTP y en los eventos. Los logs son JSON estructurado y no llevan datos personales ni tokens.

## Lenguaje ubicuo

| Español | En código | Valores / notas |
|---|---|---|
| Propiedad | `Property` | Aggregate root en listing |
| Tipo de inmueble | `PropertyType` | `HOUSE`, `APARTMENT` |
| Operación | `OperationType` | `SALE`, `RENT` |
| Estado de publicación | `PropertyStatus` | `DRAFT`, `PUBLISHED`, `PAUSED`, `RESERVED`, `SOLD`, `RENTED` |
| Característica | `Feature` | `GARAGE`, `GARDEN`, `POOL`, `COMMON_AREAS`, … |
| Ubicación / zona | `Location` | `zone`, `address`, coordenadas simuladas |
| Agente | `Agent` | Usuario con rol `AGENT` |
| Consulta | `Inquiry` | Mensaje de un interesado sobre una propiedad |
| Interesado / oportunidad | `Lead` | Seguimiento comercial de un cliente con una propiedad |
| Visita | `Visit` | `REQUESTED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`, `REJECTED` |
| Favorito | `Favorite` | Propiedad guardada por un usuario |
| Notificación | `Notification` | Aviso para un usuario |

## Flujo de trabajo Git

- `main` está protegida: solo entra código por PR, con 1 aprobación y **squash merge**.
- **Ramas:** `<tipo>/<scope>-<descripcion-corta>`, por ejemplo `feat/listing-publicar-propiedad` o `fix/visit-validar-fecha`.
- **Commits:** Conventional Commits, `tipo(scope): descripción en español`.
  - Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`.
  - Scopes: `identity`, `listing`, `visit`, `search`, `notification`, `gateway`, `frontend`, `contracts`, `infra`, `docs`, `claude`.
- **Antes de subir:** `git fetch origin` y `git rebase origin/main`. En tu propia rama usa `git push --force-with-lease`. Nunca hagas force push a `main` ni a ramas ajenas.
- **PRs chicos** (idealmente menos de 400 líneas), de un solo servicio, usando la plantilla de `.github/`.
- **Lockfiles:** se commitean (`package-lock.json`, `go.sum`, `requirements*.txt`, wrapper de Maven). No reformatees archivos que no tocaste.

## Definition of Done

- [ ] Compila y pasa lint y formato en el servicio tocado.
- [ ] Hay tests de dominio y de aplicación para la lógica nueva, y pasan.
- [ ] El contrato (OpenAPI o evento) está actualizado y coincide con la implementación.
- [ ] No hay secretos, y `.env.example` está al día.
- [ ] Si se usó un patrón de diseño, está registrado en `docs/patrones-de-diseno.md`.
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

**Agentes:** `arquitecto-ddd`, `revisor-api-rest`, `guardian-contratos`, `revisor-seguridad`, `revisor-frontend` e `ingeniero-tests`.

**Preferencias personales:** van en `CLAUDE.local.md` y `.claude/settings.local.json`. Los dos están en `.gitignore`.

## Decisiones pendientes (registrar en `docs/adr/` cuando se tomen)

- Tecnología del API Gateway.
- Dónde vive **Favoritos**: servicio propio o dentro de listing o visit.
- Framework del frontend (las clases usan Angular para Smart/Dumb).
- Base de datos de search-service y notification-service.
- Versiones exactas de cada stack.

## Comandos

- **Infraestructura:** `docker compose -f infra/docker-compose.yml up -d` (cuando exista).
- **Por servicio:** ver la rule del stack correspondiente en `.claude/rules/stack-*.md`.
