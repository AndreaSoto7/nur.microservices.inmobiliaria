# Plataforma Inmobiliaria — Microservicios (Ingeniería Web 3 · Proyecto 06)

Agentes publican casas y departamentos (venta o alquiler). Los interesados buscan con filtros, guardan favoritos, envían consultas y solicitan visitas. El docente evalúa sobre todo **DDD, eventos y uso del broker** (`docs/enunciado.md`).

## Cómo está organizado el contexto (léelo primero)

| Nivel | Archivo | Cuándo se carga | Qué contiene |
|---|---|---|---|
| 1. Raíz | este `CLAUDE.md` | Siempre | Lo que vale para todo el repo: mapa, reglas de oro, convenciones, Git, DoD |
| 2. Componente | `<carpeta>/CLAUDE.md` (tabla de abajo) | Al leer o editar archivos de esa carpeta | **Todo** lo de un servicio: dominio, casos de uso, eventos, base, API, stack, estructura, comandos y qué rules, skills y agentes usar |
| 3. Rules transversales | `.claude/rules/*.md` | Solas, según la ruta que tocas | DDD, REST, Kafka, seguridad, discovery, testing, patrones, SOLID |
| 4. Fuentes de verdad | `contracts/`, `docs/` | A pedido | Contratos, decisiones, esquemas de base, progreso |

**Reglas para trabajar con este contexto:**

- **Antes de crear o editar algo en un componente, lee su `CLAUDE.md`.** Si la carpeta todavía no tiene código, léelo igual: ahí está el diseño que hay que seguir.
- **Un tema, un solo lugar.** Lo de un servicio va en su `CLAUDE.md`; lo transversal, en una rule; las decisiones, en un ADR. No copies contenido entre archivos: enlaza.
- **Si el código y un `CLAUDE.md` no coinciden, gana el código** (o el contrato), y el `CLAUDE.md` se corrige en el mismo PR.

## Mapa de componentes

| Componente | Instrucciones | Stack | Responsable | Puerto | Base | Responsabilidad |
|---|---|---|---|---|---|---|
| identity-service | [`services/identity-service/CLAUDE.md`](services/identity-service/CLAUDE.md) | Django + DRF | @Tiesol | 8001 | `identity` | Registro, login, roles y emisión de JWT RS256 |
| listing-service | [`services/listing-service/CLAUDE.md`](services/listing-service/CLAUDE.md) | Spring Boot | @AndreaSoto7 | 8002 | `listing` | Propiedades, galería, estados, favoritos y catálogo público (lado query). Reserva al ganarse una oportunidad |
| visit-service | [`services/visit-service/CLAUDE.md`](services/visit-service/CLAUDE.md) | NestJS | _(completar)_ | 8003 | `visit` | Consultas, visitas y oportunidades (`Lead`). Rechaza o cancela visitas cuando la propiedad se reserva, vende o alquila |
| notification-service | [`services/notification-service/CLAUDE.md`](services/notification-service/CLAUDE.md) | Go | @Tiesol | 8005 | `notification` | Avisos dentro de la app ante solicitudes y cambios relevantes, a partir de eventos |
| audit-service (opcional) | [`services/audit-service/CLAUDE.md`](services/audit-service/CLAUDE.md) | por decidir | _(completar)_ | 8004 | `audit` | Registro de solo inserción de todos los eventos, para `ADMIN` |
| gateway | [`gateway/CLAUDE.md`](gateway/CLAUDE.md) | Go (propio) | @Tiesol | 8080 | — | Único punto de entrada: ruteo, JWT, CORS, rate limit, balanceo y discovery |
| frontend | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) | React + Vite + TS | _(completar)_ | 5173 | — | UI para interesados y agentes |
| infra | [`infra/README.md`](infra/README.md) | Docker Compose | Zona compartida | Kafka 9092 · UI 8090 · Consul UI 8500 | — | Kafka (KRaft), Consul, bases y puertos de depuración |

## Cómo se hablan los servicios ([ADR 0005](docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md) y [0007](docs/adr/0007-retomar-notification-service.md))

```
cliente ──HTTP──► gateway ──► identity | listing | visit | notification | audit   (réplicas descubiertas en Consul)

listing ──listing.property.events──► visit   copia local de propiedades + políticas:
                                             PropertyReserved → rechaza solicitudes pendientes
                                             PropertySold/Rented → rechaza y cancela visitas
visit   ──visit.lead.events──────────► listing   LeadClosed (WON) → reserva la propiedad
identity, listing, visit ──eventos────► notification   crea los avisos de cada usuario
todos   ──todos los topics───────────► audit     (opcional)
```

Ningún servicio llama a otro por HTTP. El detalle de cada flecha está en el `CLAUDE.md` del servicio que reacciona.

## Dónde está cada cosa (fuentes de verdad)

| Tema | Archivo |
|---|---|
| Enunciado y criterios evaluados | `docs/enunciado.md` |
| Decisiones de arquitectura | `docs/adr/` (las más recientes sobre alcance: ADR 0005 y 0007) |
| Catálogo de eventos, topics y consumidores | `contracts/events/README.md` |
| APIs HTTP | `contracts/openapi/<servicio>-service.yaml` |
| Esquemas de base de datos | `docs/base-de-datos/` |
| Patrones aplicados (para la defensa) | `docs/patrones-de-diseno.md` |
| Progreso por componente | `docs/progreso/` |
| Cómo revisar y mergear | `docs/flujo-de-revision.md` |

## Reglas de oro (no negociables)

1. **Cada servicio es dueño de sus datos.** Nunca leer ni escribir la base de otro. No se comparten tablas ni modelos de dominio.
2. **Los servicios se comunican por eventos en Kafka.** El cliente entra solo por el gateway. Una llamada HTTP entre servicios solo con un ADR que la justifique.
3. **Contract-first.** Todo cambio de API o de evento va primero en `contracts/`, en su propio PR. Nunca se rompe un contrato publicado: se versiona.
4. **Arquitectura limpia.** Dependencias hacia adentro: `presentation`/`infrastructure` → `application` → `domain`. El dominio no importa frameworks.
5. **CQRS.** Los comandos cambian estado y no devuelven datos de lectura; las consultas no cambian estado.
6. **Patrones justificados.** Cada patrón aplicado se registra en `docs/patrones-de-diseno.md`.
7. **Solo tocas tu componente.** Para cambiar el de otra persona, coordina con su responsable. Las zonas compartidas (`contracts/`, `infra/`, `docs/adr/`, `.claude/`, los `CLAUDE.md`) requieren PR revisado por al menos otra persona.
8. **Cero secretos en git.** `.env` nunca se sube; `.env.example` sí, y se actualiza con cada variable nueva.
9. **KISS y YAGNI.** Primero el alcance obligatorio. audit-service y los extras, después.

## Convenciones globales

- **Idioma:** código (incluidos los nombres de los tests y las rutas del frontend), endpoints, eventos, tablas y columnas en inglés. Documentación, comentarios, PRs, issues y descripción de commits en español. Los textos que ve el usuario en la interfaz y los mensajes de error van en español.
- **IDs:** UUID como string, generados por el dominio. Nunca IDs autoincrementales expuestos.
- **Fechas:** ISO-8601 en UTC (`2026-10-16T14:30:00Z`).
- **Dinero:** `{ "amount": 125000.00, "currency": "BOB" }`. Una sola moneda, **BOB**. Nunca float en el dominio.
- **JSON:** camelCase en APIs y eventos. Enums en `UPPER_SNAKE_CASE`.
- **Errores HTTP:** RFC 9457 `application/problem+json` (rule `api-rest`).
- **Auth:** identity emite un JWT RS256 de 15 min (`sub`, `email`, `roles`, `iss=identity-service`, `aud=inmobiliaria`, header `typ=at+jwt`) con refresh token. Roles: `CLIENT`, `AGENT`, `ADMIN`. Cada servicio valida el token con el JWKS (rule `seguridad`).
- **Trazabilidad:** `X-Correlation-Id` en HTTP y en los eventos. Logs en JSON, sin datos personales ni tokens.

## Lenguaje ubicuo (compartido entre servicios)

| Español | En código | Valores / notas |
|---|---|---|
| Propiedad | `Property` | Aggregate de listing. En el event storming le dijimos "Listing": en código siempre `Property` |
| Estado de publicación | `PropertyStatus` | `DRAFT`, `PUBLISHED`, `PAUSED`, `RESERVED`, `SOLD`, `RENTED` |
| Tipo / operación | `PropertyType` / `OperationType` | `HOUSE`, `APARTMENT` / `SALE`, `RENT` |
| Agente / interesado | rol `AGENT` / rol `CLIENT` | `agentId` y `clientId` son el `sub` del JWT |
| Consulta | `Inquiry` | Mensaje de un interesado sobre una propiedad |
| Visita | `Visit` | `REQUESTED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`, `REJECTED` |
| Oportunidad | `Lead` | Seguimiento comercial de un cliente con una propiedad. `OPEN` / `CLOSED` con `LeadOutcome` `WON` o `LOST` |
| Favorito | `Favorite` | Propiedad guardada por un usuario (aggregate de listing, ADR 0003) |
| Quién actúa | `Actor` | `CLIENT`, `AGENT`, `SYSTEM` (`SYSTEM` = una política que reacciona a un evento) |
| Política | handler de evento | "Cuando pasa X, entonces se ejecuta Y" en otro aggregate (ADR 0005) |

Los términos propios de un solo servicio están en su `CLAUDE.md`.

## Flujo de trabajo Git

- `main` está protegida: solo entra código por PR, con 1 aprobación y **squash merge**. **Otra persona aprueba y el autor mergea su propio PR.** Guía: `docs/flujo-de-revision.md`.
- **Todo PR tiene base `main`**, sin encadenar. Si un trabajo depende de otro, se abre cuando el primero ya está en `main`.
- **Ramas:** `<tipo>/<scope>-<descripcion-corta>` (`feat/listing-publicar-propiedad`).
- **Commits:** Conventional Commits, `tipo(scope): descripción en español`.
  - Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`.
  - Scopes: `identity`, `listing`, `visit`, `notification`, `audit`, `gateway`, `frontend`, `contracts`, `infra`, `docs`, `claude`.
- **Antes de subir:** `git fetch origin` y `git rebase origin/main`. En tu rama, `git push --force-with-lease`. Nunca force push a `main` ni a ramas ajenas.
- **PRs chicos** (idealmente menos de 400 líneas) y de un solo componente, con la plantilla de `.github/`.
- **Lockfiles** se commitean. No reformatees archivos que no tocaste.

## Definition of Done

- [ ] Compila y pasa lint y formato en el componente tocado.
- [ ] Tests de dominio y de aplicación para la lógica nueva, y pasan.
- [ ] El contrato (OpenAPI o evento) está actualizado y coincide con la implementación.
- [ ] Sin secretos; `.env.example` al día.
- [ ] Patrón de diseño usado → registrado en `docs/patrones-de-diseno.md`.
- [ ] `docs/progreso/<componente>.md` actualizado (historial y pendientes).
- [ ] Si cambió algo que describe el `CLAUDE.md` del componente (eventos, tablas, rutas, comandos), está actualizado.
- [ ] PR con la plantilla completa y una revisión aprobada.

## Trabajar con Claude en este repo

**Rules transversales** (se cargan solas por ruta):

| Rule | Se carga en | Trata |
|---|---|---|
| `ddd-clean-architecture` | `services/**` | Capas, aggregates, CQRS, eventos de dominio vs. integración |
| `api-rest` | `services/**`, `gateway/**`, `contracts/openapi/**` | Rutas, status, problem+json, paginación, mapa de rutas del gateway |
| `eventos-kafka` | `contracts/events/**`, código de mensajería, `infra/**` | Envelope, outbox, consumidores idempotentes, versionado |
| `seguridad` | código, `infra/**`, compose y `.env.example` | JWT, autorización, entrada, secretos, puertos |
| `service-discovery` | `services/**`, `gateway/**`, `infra/**` | Contrato común de registro en Consul y health checks |
| `testing` | `services/**`, `gateway/**`, `frontend/**` | Pirámide de tests y reglas |
| `patrones-diseno` · `principios-solid` | código y `docs/patrones-de-diseno.md` | Catálogo de patrones del proyecto y principios |

**Skills** (escribe `/nombre`):

| Skill | Para qué sirve |
|---|---|
| `/iniciar-tarea` | Rama correcta, sincronizar con `main` y plan por capas |
| `/scaffold-servicio` | Esqueleto inicial de un componente según su `CLAUDE.md` |
| `/caso-de-uso` | Un comando o una consulta con DDD + CQRS |
| `/nuevo-endpoint` | Endpoint REST contract-first (OpenAPI → código → tests) |
| `/nuevo-evento` | Evento Kafka: schema, catálogo, productor y consumidores |
| `/aplicar-patron` | Elegir, implementar y registrar un patrón |
| `/componente-front` | Componentes Smart/Dumb en el frontend |
| `/revisar` | Autorrevisión antes del PR (lanza un agente revisor si hace falta) |
| `/crear-pr` | Commit, rebase y PR con la plantilla |
| `/resolver-conflicto` | Conflictos de merge o rebase sin perder trabajo |
| `/adr` | Registrar una decisión de arquitectura |

**Agentes revisores:** `arquitecto-ddd` (dominio y capas), `guardian-contratos` (contratos y eventos) y `revisor-seguridad`. **Uno solo por PR**, el del riesgo principal: cada agente parte de cero y consume muchos tokens. `arquitecto-ddd` y `guardian-contratos` corren con Sonnet.

**Lecciones (ya nos pasaron):**

- **Un PR con base en otra rama** queda "Merged" sin llegar a `main` (#9 a #11, recuperados en #13 a #15). Después de mergear, verifica que el cambio esté en `main`.
- **`git add` por ruta**, nunca `git add -A` sobre una carpeta: así se coló un archivo local en un PR.
- **No reformatees JSON con un script:** infla el diff. Edita solo la línea que cambia.
- **Windows:** el repo tiene rutas largas. Clona con `git clone -c core.longpaths=true …`.

**Preferencias personales:** en `CLAUDE.local.md` y `.claude/settings.local.json` (los dos en `.gitignore`).

## Decisiones pendientes (registrar en `docs/adr/` cuando se tomen)

- Stack y responsable de audit-service, si se construye.
- Versiones exactas de cada stack (gateway ya usa Go 1.27; identity, Python 3.13 y Django 5.2).
- Librerías de router y de datos del frontend (ADR 0004).

## Comandos de infraestructura

Detalle en `infra/README.md`. Los de cada servicio, en su `CLAUDE.md`.

```bash
docker compose -f infra/docker-compose.yml up -d                                   # todo
docker compose -f infra/docker-compose.yml up -d --scale listing-service=3         # demo de balanceo
docker compose -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d # puertos de depuración en 127.0.0.1
```
