# Revisión de la configuración de Claude Code

- **Fecha:** 2026-10-20
- **Alcance:** `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `.claude/settings.json`, y su comparación con lo instalado globalmente en `~/.claude/` (skills, agents, commands, plugins).
- **Nota:** es solo un diagnóstico. No se modificó ningún archivo del repo salvo este informe.

---

## 1. Resumen

1. **La configuración del repo es sólida.** Es coherente con el enunciado, está bien repartida (rules por ruta, skills por flujo, agents revisores de solo lectura) y cubre 5 de los 6 criterios evaluados con bastante detalle.
2. **El hueco grande es el API Gateway.** Es el criterio obligatorio n.º 1 del enunciado, pero en la configuración solo aparece como "por decidir". El ADR 0001 no menciona Go entre las opciones, ninguna rule se carga en `gateway/**` con instrucciones de stack, `/scaffold-servicio` no lo acepta y `/revisar` no le asigna revisor. Ver la sección 4.
3. **Las skills globales de tu máquina son genéricas.** Casi todas se solapan con las del proyecto, que son más específicas. Dos contradicen convenciones del equipo (`git-workflow-and-versioning` y `api-and-interface-design`) y varias no aportan nada a este proyecto. Ver la sección 6.
4. **Hay inconsistencias menores** entre rules, skills y contratos que conviene corregir antes de que cada uno empiece su servicio. Ver la sección 5.

---

## 2. Inventario del repo

| Tipo | Cantidad | Detalle |
|---|---|---|
| `CLAUDE.md` | 1 (raíz) | No hay `CLAUDE.md` por servicio. Todavía no existe ningún servicio. |
| Rules | 12 | Todas con `paths:`, así que **ninguna se carga hoy**: no existen `services/`, `gateway/`, `frontend/` ni `infra/`. Se activarán solas cuando haya código. |
| Skills | 11 | 5 las invoca Claude solo (`caso-de-uso`, `nuevo-endpoint`, `nuevo-evento`, `aplicar-patron`, `componente-front`). 6 son manuales, con `disable-model-invocation: true` (`iniciar-tarea`, `scaffold-servicio`, `revisar`, `crear-pr`, `resolver-conflicto`, `adr`). Es una buena decisión: las que tocan git o crean estructura las dispara una persona. |
| Agents | 6 | 5 revisores de solo lectura y `ingeniero-tests`, que puede editar pero solo tests. |
| `settings.json` | 1 | Allow, ask y deny razonables. Bloquea force push, `reset --hard`, lectura de `.env` y claves. |

---

## 3. Cobertura de los criterios del enunciado

| Criterio obligatorio | Dónde se cubre | Estado |
|---|---|---|
| 1. API Gateway | Solo en la tabla de `CLAUDE.md`, el mapa de rutas de `api-rest.md` y la sección "Gateway" de `seguridad.md` | ⚠️ **Incompleto** (sección 4) |
| 2. DDD + arquitectura limpia | `ddd-clean-architecture.md`, `stack-*.md`, `/caso-de-uso`, `arquitecto-ddd` | ✅ |
| 3. Persistencia independiente | Regla de oro 1, una base y un puerto por servicio, `arquitecto-ddd` | ✅ (falta decidir la base de search y de notification) |
| 4. CQRS | Regla de oro 5, `ddd-clean-architecture.md`, listing → search | ✅ |
| 5. Eventos | `eventos-kafka.md`, catálogo en `contracts/events/`, `/nuevo-evento`, `guardian-contratos` | ✅ |
| 6. Patrones justificados | `patrones-diseno.md`, `/aplicar-patron`, `docs/patrones-de-diseno.md` | ✅ (faltan los patrones propios del gateway) |

---

## 4. API Gateway en Go: qué falta

### 4.1 Lugares que hoy no lo contemplan

| Archivo | Problema |
|---|---|
| `CLAUDE.md`, tabla de servicios | `gateway` aparece con stack "por decidir (ADR)". |
| `CLAUDE.md`, "Decisiones pendientes" | Sigue listando "Tecnología del API Gateway". |
| `docs/adr/0001-arquitectura-y-stack.md` | Las opciones listadas son Spring Cloud Gateway, Traefik, Nginx y KrakenD. Ninguna es un gateway propio en Go. |
| `.claude/rules/stack-go.md` | `paths` solo cubre `services/search-service/**` y `services/notification-service/**`. Al tocar `gateway/**` **no se carga ninguna rule de stack**. Además, su estructura (`domain/`, `postgres/`, `kafka/`) no le sirve a un gateway, que no tiene dominio, base de datos ni Kafka. |
| `.claude/rules/testing.md` | La tabla de herramientas no tiene fila para el gateway. |
| `.claude/skills/scaffold-servicio` | Solo acepta `identity\|listing\|visit\|search\|notification`. El módulo Go que propone vive en `services/…`, pero el gateway está en `gateway/`. Exige `domain/` y `application/`, que en el gateway sobran. |
| `.claude/skills/revisar` | La tabla "si cambió… → agente" no menciona `gateway/`. Un cambio en el gateway solo lo revisaría `revisor-seguridad`, y únicamente si se interpreta como "auth o config". |
| `.claude/agents/arquitecto-ddd.md` | Describe el stack sin el gateway. No pasa nada grave, porque el gateway no debe tener DDD, pero conviene aclarar que no se le aplica. |
| `.claude/agents/revisor-seguridad.md` y `revisor-api-rest.md` | No tienen checks específicos de gateway: borrar headers de identidad que llegan de fuera, timeouts hacia los servicios, límite de tamaño del body en las subidas, 502/504 en problem+json. |
| `docs/patrones-de-diseno.md` y `rules/patrones-diseno.md` | Falta **Chain of Responsibility** (la cadena de middlewares) y **Proxy** (el reverse proxy), que son los patrones naturales de un gateway en Go y fáciles de defender. |
| `README.md` | La tabla de stacks no incluye el gateway ni el frontend. |

### 4.2 Decisión previa: ¿Go "a mano" o KrakenD?

KrakenD está escrito en Go, pero se configura con JSON. Si el equipo dice "gateway en Go", conviene dejar claro en el ADR cuál de las dos opciones elige:

| Opción | A favor | En contra |
|---|---|---|
| **Gateway propio en Go** (`net/http` + `httputil.ReverseProxy` + middlewares) | Hay código que mostrar en la defensa (patrones Proxy, Chain of Responsibility y Facade). Usa el mismo stack y las mismas convenciones que search y notification. Pocas dependencias. | Hay que escribir JWT/JWKS, CORS, rate limit y timeouts. Son unas pocas centenas de líneas. |
| **KrakenD** (binario Go, configuración declarativa) | JWT con JWKS, CORS y rate limit vienen listos. Casi no hay código. | No hay "código Go" del equipo que evaluar. Los patrones quedan en la configuración y son más difíciles de justificar. |

**Recomendación:** gateway propio en Go, solo con la librería estándar más 2 o 3 librerías chicas (validación JWT/JWKS y rate limit). Encaja con KISS y con el criterio 6 del enunciado.

### 4.3 Lo que debería decir una rule `stack-gateway` (propuesta, sin implementar)

- **paths:** `gateway/**`
- **Estructura:** `cmd/gateway/main.go`, `internal/config/` (la tabla de rutas sale del mapa de `api-rest.md`), `internal/proxy/`, `internal/middleware/` (recover, correlation-id, logging, CORS, rate limit, auth), `internal/auth/` (JWKS con caché), `internal/problem/`.
- **Sin** `domain/` ni `application/`: el gateway no tiene lógica de negocio. Dejarlo explícito, para que nadie meta reglas de negocio ahí.
- **Responsabilidades:**
  - Genera `X-Correlation-Id` si no llega y lo propaga.
  - Valida el JWT de las rutas protegidas como defensa temprana. **Reenvía el `Authorization` intacto**, porque cada servicio vuelve a validar (`CLAUDE.md`). **Borra** cualquier `X-User-*` que llegue del cliente.
  - Rutas públicas: catálogo (`/api/v1/search/**`), detalle, registro, login y el JWKS de identity.
  - CORS restringido a `http://localhost:4200` (configurable por variable de entorno).
  - Rate limit por IP en login y registro (token bucket en memoria; basta para el proyecto).
  - Timeout por servicio destino. Responde 502/504 en `application/problem+json`.
  - Límite de body compatible con la subida de imágenes (5 MB por imagen, según `seguridad.md`).
  - `GET /health` y `GET /health/ready`.
- **Módulo:** `github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway`.
- **Tests:** `httptest` con servicios falsos, table-driven: ruteo, 401 sin token, borrado de headers falsos, 429 y CORS.
- **Bloqueo pendiente:** la ruta `/api/v1/favorites/**` depende del ADR de Favoritos.

---

## 5. Otras inconsistencias encontradas

| Severidad | Dónde | Qué pasa | Sugerencia |
|---|---|---|---|
| 🟡 | `CLAUDE.md`, columna "Responsable" | Todo dice _(completar)_. `/iniciar-tarea`, `/crear-pr` y `guardian-contratos` dependen de esa tabla para avisar a quién coordinar. | Completarla ya. |
| 🟡 | `stack-go.md` y `CLAUDE.md` | La base de search y de notification está "por decidir", pero la rule ya asume PostgreSQL con `pgx` (`infrastructure/postgres/`). Los puertos 5433–5437 también suponen 5 Postgres. | Decidirlo en un ADR o marcarlo en la rule como provisional. |
| 🟡 | `contracts/events/envelope.schema.json` | Tiene `additionalProperties: false`. Agregar un campo al envelope en el futuro (por ejemplo `traceId`) rompería a los consumidores que validan estricto. Es lo contrario de la filosofía de los payloads (`true`). | Decidirlo a propósito: o `true`, o documentar que cambiar el envelope exige versión y ADR. |
| 🔵 | `skills/nuevo-evento`, checklist | La lista de campos del envelope omite `aggregateType`, que sí exigen el schema, la rule y `guardian-contratos`. | Agregarlo al checklist. |
| 🔵 | Nombres de OpenAPI | Unos archivos dicen `contracts/openapi/<servicio>.yaml` y otros `<servicio>-service.yaml`. Coinciden solo si `<servicio>` ya incluye `-service`. | Unificar en un solo formato: `identity-service.yaml`. |
| 🔵 | `testing.md` (listing) | El lint de Java es "Spotless (si se adopta)", pero el DoD exige "pasa lint y formato". | Decidir Spotless o Checkstyle. |
| 🔵 | `CLAUDE.md` vs `seguridad.md` | `CLAUDE.md` lista los claims `sub`, `email` y `roles`. La rule agrega `iss` y `aud`. | Alinear `CLAUDE.md`. |
| 🔵 | `patrones-diseno.md` vs `docs/patrones-de-diseno.md` | La rule menciona **Mediator** (`CommandBus`/`QueryBus`), pero no aparece en la tabla de planificados ni en la descripción de `/aplicar-patron`. | Agregarlo junto con Proxy y Chain of Responsibility. |
| 🔵 | `.github/` | No hay `CODEOWNERS` ni workflows de CI. La regla de oro 7 (las zonas compartidas requieren revisión) y el DoD ("pasa lint") dependen de la disciplina de cada uno. | `CODEOWNERS` para `contracts/`, `infra/`, `docs/adr/`, `.claude/` y `CLAUDE.md`. CI con filtros por ruta cuando existan los servicios. |
| 🔵 | `settings.json` | No están en `allow` `go run`, `go mod tidy` (lo usa `/resolver-conflicto`), `npm ci` (lo pide `stack-nestjs`), `npm run start:dev` ni `./mvnw spring-boot:run`. Funcionan, pero piden confirmación. El deny `git push * main` no cubre `git push origin HEAD:main`, aunque la protección de `main` en GitHub sí lo frena. | Opcional. |
| 🔵 | `README.md` | Le faltan el gateway y el frontend. | Agregarlos. |

---

## 6. Skills, agents y commands globales vs. los del proyecto

Lo global viene de **addyosmani/agent-skills** (enlazado en `~/.local/share/agent-skills`), de las skills de Anthropic sincronizadas y de **graphify**. Tu `~/.claude/CLAUDE.md` solo registra graphify. No hay servidores MCP configurados.

**Leyenda:**
- ✅ **Útil:** aporta algo que el proyecto no tiene.
- 🔁 **Solapa:** usa la del proyecto.
- ⚠️ **Contradice:** choca con las convenciones del equipo.
- ⛔ **Irrelevante:** no aplica a este proyecto.

### 6.1 Skills de agent-skills

| Skill global | Equivalente en el proyecto | Veredicto |
|---|---|---|
| `git-workflow-and-versioning` | `/iniciar-tarea`, `/crear-pr`, `/resolver-conflicto`, "Flujo de trabajo Git" | ⚠️ Se activa con "cualquier cambio de código". Desaconseja el squash ("destroys the development narrative"), pero el equipo usa **squash merge**. También empuja semver y changelog, que aquí sobran. Usa las skills del proyecto. |
| `api-and-interface-design` | `rules/api-rest.md`, `/nuevo-endpoint`, `revisor-api-rest` | ⚠️ Propone errores `{ error: { code, message } }` en vez de **problem+json**, paginación `{ data, pagination }` en vez de `{ data, page }`, y la "One-Version Rule" en contra de `/api/v2` conviviendo con v1. La rule del proyecto gana cuando se carga, pero no la uses aquí. |
| `documentation-and-adrs` | `/adr` | 🔁 Respeta la convención existente (`docs/adr/`), pero `/adr` ya conoce la plantilla y las decisiones pendientes. |
| `code-review-and-quality` + `/review` | `/revisar` y los 5 agentes revisores | 🔁 `/revisar` valida reglas de oro, contratos y DoD. La global es genérica. |
| `test-driven-development` + `/test` | `rules/testing.md`, `ingeniero-tests`, `/caso-de-uso` | 🔁/✅ Compatible: el proyecto también pide tests de dominio primero. Sirve para el ciclo red-green en bugs. |
| `security-and-hardening` | `rules/seguridad.md`, `revisor-seguridad` | ✅ Complementa: auditoría de dependencias (`npm audit`, `govulncheck`, `pip-audit`) y OWASP, que el proyecto no cubre. |
| `frontend-ui-engineering` | `/componente-front`, `rules/frontend-smart-dumb.md` | ✅ Complementa en accesibilidad y diseño responsive. Úsala junto con la del proyecto cuando se elija el framework. |
| `planning-and-task-breakdown` + `/planning` | `/iniciar-tarea` (paso 4) | 🔁 `/iniciar-tarea` ya crea la rama y planifica por capas. La global sirve para partir una épica grande en varias tareas o PRs. |
| `incremental-implementation` + `/build` | `/caso-de-uso` | ✅ con cuidado. `/build` hace **un commit por tarea**: úsalo solo en una rama de feature, nunca en `main`, y revisa que los mensajes sigan Conventional Commits en español. |
| `spec-driven-development` + `/spec` | `docs/enunciado.md`, contract-first | ⛔/opcional. El enunciado y los contratos cumplen el papel de la spec. Además genera `SPEC.md` y `tasks/plan.md` en la raíz, que no deben colarse en un PR. |
| `ci-cd-and-automation` | — | ✅ Útil cuando haya servicios: un workflow de GitHub Actions por servicio con filtros por ruta. Es zona compartida y va con PR revisado. |
| `source-driven-development` | — | ✅ Útil para la decisión pendiente de **versiones exactas** de cada stack y para no usar APIs obsoletas de Spring, Nest o Django. |
| `debugging-and-error-recovery` | — | ✅ Genérica y útil. |
| `context-engineering` | — | ✅ Útil para mantener `CLAUDE.md` y las rules, como en esta revisión. |
| `interview-me`, `idea-refine` | — | ✅ Útiles para las decisiones pendientes: Favoritos, gateway, bases de datos. |
| `code-simplification` + `/code-simplify` | — | ✅ Genérica. Antes de usarla, considera el built-in `/simplify`. |
| `observability-and-instrumentation` | Trazabilidad en `CLAUDE.md` | 🔁 Lo necesario (correlation-id, logs JSON) ya está en las rules. Métricas y alertas son YAGNI aquí. |
| `doubt-driven-development` | — | Opcional y costosa. Solo para auth o migraciones delicadas. |
| `constraint-driven-development` + `/constraints` | Definition of Done | 🔁 Crearía un `CONSTRAINTS.md` que duplica el DoD. No hace falta. |
| `deprecation-and-migration` | Versionado en `eventos-kafka.md` y `api-rest.md` | ⛔ El proyecto parte de cero. Como mucho, sirve para un futuro `v2` de un evento. |
| `performance-optimization`, `/webperf`, `web-performance-auditor` | — | ⛔ Por ahora. A lo sumo, índices de search-service. |
| `shipping-and-launch`, `/ship` | — | ⛔ No hay despliegue a producción. Además, `/ship` usa los agents genéricos y no los del proyecto. |
| `browser-testing-with-devtools` | — | ⛔ Requiere el MCP de Chrome DevTools, que **no está configurado**, y todavía no hay frontend. |
| `using-agent-skills` | — | Meta-skill. Ni suma ni resta. |

### 6.2 Agents globales

| Agent global | Equivalente en el proyecto | Veredicto |
|---|---|---|
| `code-reviewer` | `arquitecto-ddd`, `revisor-api-rest`, `revisor-frontend` | 🔁 Genérico y **con permiso para editar**. Los del proyecto son de solo lectura y conocen las reglas de oro. Pide por nombre los del proyecto. |
| `security-auditor` | `revisor-seguridad` | 🔁 Úsalo solo para una auditoría OWASP amplia. |
| `test-engineer` | `ingeniero-tests` | 🔁 `ingeniero-tests` conoce la pirámide y los comandos de cada stack. |
| `web-performance-auditor` | — | ⛔ |

### 6.3 Otras skills instaladas

| Skill | Veredicto |
|---|---|
| `graphify` | Opcional. Su descripción ("cualquier pregunta sobre un codebase") es muy amplia y puede activarse sin necesidad. Tiene sentido cuando el monorepo crezca. |
| `pptx` / `docs` / `pdf` | ✅ Útiles para la **presentación y defensa** del proyecto y para exportar ADRs o el registro de patrones. |
| Built-ins de Claude Code: `/code-review`, `/security-review`, `/simplify` | Complementos razonables de `/revisar`. No lo reemplazan, porque no conocen el DoD ni los contratos. |
| `docx`, `xlsx`, `morning`, `import-memory`, `computer-use`, `chrome-browser`, `built-in-browser`, `deep-research`, `google-workspace`, `skill-creator` | ⛔ No aplican al proyecto. `skill-creator` solo sirve si se quiere crear o mejorar una skill del equipo. |

### 6.4 Qué usar para cada tarea

| Tarea | Usa | Evita |
|---|---|---|
| Empezar una tarea | `/iniciar-tarea` | `git-workflow-and-versioning`, `/spec` |
| Lógica de negocio | `/caso-de-uso` (+ `/test` para bugs) | — |
| Endpoint | `/nuevo-endpoint` | `api-and-interface-design` |
| Evento | `/nuevo-evento` | — |
| Patrón | `/aplicar-patron` | — |
| Frontend | `/componente-front` + `frontend-ui-engineering` | — |
| Revisar antes del PR | `/revisar` (+ opcional `/security-review`) | `/review`, `/ship`, agent `code-reviewer` |
| PR / conflictos | `/crear-pr`, `/resolver-conflicto` | `git-workflow-and-versioning` |
| Decisión de arquitectura | `interview-me` → `/adr` | `documentation-and-adrs` |
| Versiones de cada stack | `source-driven-development` → `/adr` | — |
| CI | `ci-cd-and-automation` (PR a zona compartida) | — |

Si quieres que Claude prefiera siempre las del proyecto, puedes anotarlo en tu `CLAUDE.local.md` personal (está en `.gitignore`). Por ejemplo: "En este repo usa las skills y los agents de `.claude/`, no los genéricos de agent-skills".

---

## 7. Correcciones propuestas, en orden

Todas tocan zonas compartidas: van con PR revisado por al menos otra persona y aviso al grupo (regla de oro 7).

1. **ADR 0002: gateway en Go** (con `/adr`). Opción elegida (propio vs. KrakenD), librerías y responsabilidades (sección 4.3).
2. **PR `chore(claude)`: soporte del gateway.**
   - Rule `stack-gateway.md`, o una sección de gateway con `paths: gateway/**`.
   - `/scaffold-servicio` acepta `gateway`, sin `domain/` y con el módulo correcto.
   - `/revisar` mapea `gateway/**` → `revisor-seguridad` + `revisor-api-rest`.
   - Checks de gateway en los dos agentes.
   - Fila del gateway en `testing.md`.
   - Proxy, Chain of Responsibility y Mediator en la rule de patrones y en `/aplicar-patron`.
3. **PR `docs`:**
   - `CLAUDE.md`: stack del gateway, decisiones pendientes, responsables y claims del JWT.
   - `README.md`.
   - `docs/patrones-de-diseno.md`: patrones del gateway como planificados.
   - ADR 0001: marcar el gateway como resuelto en el ADR 0002.
4. **PR `contracts`:** decidir el `additionalProperties` del envelope y unificar los nombres de OpenAPI.
5. **PR `chore(claude)` menor:** `aggregateType` en el checklist de `/nuevo-evento` y permisos extra en `settings.json` (opcional).
6. **Pendientes de decisión** (un ADR cada uno): Favoritos (bloquea una ruta del gateway), base de search y de notification, frontend, versiones exactas y linter de Java.
7. **Más adelante:** `CODEOWNERS` y CI por servicio.
