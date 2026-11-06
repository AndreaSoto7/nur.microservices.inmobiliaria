# visit-service — NestJS (TypeScript)

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica. La base local y el modelo inicial de visitas están en desarrollo. Consulta el [README](README.md) para ejecutar la base. Si algo no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | _(completar)_ |
| Stack | NestJS (TypeScript estricto), npm |
| Puerto | 8003 |
| Base | `visit` (PostgreSQL 17) → [`docs/base-de-datos/visit-service.md`](../../docs/base-de-datos/visit-service.md) |
| API | [`contracts/openapi/visit-service.yaml`](../../contracts/openapi/visit-service.yaml) (contrato inicial propuesto) · Swagger UI en `/docs` |
| Rutas del gateway | `/api/v1/inquiries/**`, `/api/v1/visits/**`, `/api/v1/leads/**` |
| Publica | `visit.inquiry.events`, `visit.visit.events`, `visit.lead.events` |
| Consume | `listing.property.events` |
| Progreso | [`docs/progreso/visit-service.md`](../../docs/progreso/visit-service.md) |
| Decisiones | ADR 0005 (políticas y oportunidades) |

## Qué hace y qué no

- **Hace:** consultas de interesados, solicitudes y programación de visitas, oportunidades (`Lead`) con su seguimiento, y las reacciones automáticas a los cambios de estado de las propiedades.
- **No hace:** cambiar el estado de una propiedad (lo decide listing al recibir `LeadClosed`), ni llamar a listing por HTTP: lo que sabe de las propiedades viene de su copia local.

## Dominio

| Aggregate | Estados | Invariantes del event storming |
|---|---|---|
| `Inquiry` | — | Propiedad `PUBLISHED`; mensaje y datos de contacto obligatorios |
| `Visit` | `REQUESTED → SCHEDULED → COMPLETED`; `REQUESTED → REJECTED`; `SCHEDULED → CANCELLED` | Propiedad `PUBLISHED`; fecha propuesta futura; **máx. 1 solicitud pendiente por cliente y propiedad**; **el agente no tiene dos visitas que se crucen**; rechazo con motivo obligatorio; el cliente o agente asignado cancela solo antes de la hora de inicio; el agente asignado completa al llegar o pasar la hora de fin |
| `Lead` (oportunidad) | `OPEN → CLOSED` (`WON` o `LOST`) | Una sola abierta por cliente y propiedad; seguimiento solo del agente asignado, con nota, y si está abierta; resultado obligatorio al cerrar |

Toda transición inválida lanza un error de dominio → 409. `LeadFollowUp` es entidad hija de `Lead`.

**Modelo de lectura `PropertySnapshot`:** copia local de cada propiedad (`propertyId`, `agentId`, `status`, `operationType`, `title`, `zone`). Solo la escribe el consumidor de `listing.property.events`; ningún comando la modifica.

## Casos de uso (event storming → código)

| Diagrama | Comando o consulta | Evento |
|---|---|---|
| `sendConsultationCommand` | `SendInquiryCommand` | `InquiryReceived` |
| `requestVisitCommand` | `RequestVisitCommand` | `VisitRequested` |
| `programVisitCommand` | `ScheduleVisitCommand` | `VisitScheduled` |
| `declineVisitCommand` | `RejectVisitCommand` | `VisitRejected` |
| `cancelVisitCommand` | `CancelVisitCommand` | `VisitCancelled` |
| `registerVisitConcludedCommand` | `CompleteVisitCommand` | `VisitCompleted` |
| _(política interna)_ | `OpenLeadCommand` | `LeadOpened` |
| `registerVisitTracing` | `RegisterLeadFollowUpCommand` | `LeadFollowUpRegistered` |
| `closeOportunityCommand` | `CloseLeadCommand` | `LeadClosed` (lo consume listing) |
| — | `GetVisitByIdQuery` (cliente dueño o agente asignado) | — |
| — | `ListMyVisitsQuery` (cliente), `ListAgentVisitsQuery`, `ListAgentInquiriesQuery`, `ListAgentLeadsQuery` | — |

`VisitRejected` lleva `reason` obligatorio y `actor` (`AGENT` o `SYSTEM`). `VisitCancelled` lleva `reason` (puede ser `null`) y `actor` (`CLIENT`, `AGENT` o `SYSTEM`). `LeadClosed` lleva `propertyId`, `agentId`, `clientId` y `outcome`.

## Eventos y políticas

- **Publica** con outbox, clave = id del aggregate. Catálogo en `contracts/events/README.md`. Visit ya genera `VisitRequested`, `LeadOpened`, `VisitScheduled`, `VisitRejected`, `VisitCancelled` y `VisitCompleted`. El rechazo y la cancelación automáticos quedan pendientes de las políticas de Listing.
- **Consume** `listing.property.events` (consumer group `visit-service`, desde el principio, idempotente con `processed_events`):
  1. **Copia local:** upsert de `PropertySnapshot` solo si `occurredAt` es más nuevo que el último aplicado.
  2. **Política 3.2 — `PropertyReserved`:** `RejectVisitCommand` por cada visita `REQUESTED` de la propiedad, con `reason: PROPERTY_RESERVED` y `actor: SYSTEM`. Las `SCHEDULED` se mantienen.
  3. **Política 3.3 — `PropertySold` / `PropertyRented`:** `RejectVisitCommand` por cada `REQUESTED` y `CancelVisitCommand` por cada `SCHEDULED` futura, con `reason: PROPERTY_UNAVAILABLE`. Las `SCHEDULED` ya pasadas quedan para el agente.
- **Política interna 3.4:** `InquiryReceived` o `VisitRequested` → `OpenLeadCommand` si no hay un `Lead` abierto para ese cliente y propiedad (misma transacción; ver `docs/base-de-datos/visit-service.md`).
- **Reglas comunes de las políticas:** el comando con `actor: SYSTEM` se salta "solo el agente…" pero no las reglas de estado. Si una regla de estado lo rechaza: `WARN` y sigue, sin DLQ. **Una transacción por visita**, y el `processed_events` del evento al final: si se reprocesa, solo se tocan las visitas que siguen pendientes.

## Estructura

```
src/
  main.ts  app.module.ts
  shared/                     filtro problem+json, correlation-id, auth guard (JWKS), health, idempotencia
    discovery/                registro y baja en Consul
  properties/                 PropertySnapshot: consumidor de listing.property.events y repositorio
  inquiries/  visits/  leads/
    domain/                   aggregate, value objects, eventos, Repository (interfaz + token)
    application/
      commands/               request-visit.command.ts + request-visit.handler.ts, ...
      queries/                list-my-visits.query.ts + handler
      policies/               reject-visits-on-property-reserved.policy.ts, ...
      ports/                  EventPublisher, Clock
    infrastructure/
      persistence/            *.orm-entity.ts, typeorm-*.repository.ts, mappers
      messaging/              outbox, productor Kafka, mappers a eventos de integración
    presentation/             controllers, dto/ (class-validator)
    <modulo>.module.ts
test/
```

## Decisiones técnicas

- **CQRS:** `@nestjs/cqrs` (`CommandBus`, `QueryBus`, `EventBus`). Los controladores y las políticas solo despachan comandos.
- **Repositorios por token:** interfaz en `domain` (`export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY')`), implementación registrada en el módulo.
- **Persistencia:** TypeORM con migraciones (`synchronize: false` siempre; nombres con timestamp). `@VersionColumn` en `Visit` y `Lead`. El índice de exclusión de horarios y los índices únicos parciales van con `queryRunner.query(...)`.
- **Validación:** `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- **TypeScript estricto:** `strict: true`. Prohibido `any`; usa `unknown` y estrecha el tipo.
- **Errores:** `ExceptionFilter` global que mapea errores de dominio a problem+json.
- **Kafka:** `@nestjs/microservices` con `Transport.KAFKA` (kafkajs) para consumir; el relay del outbox publica con el productor.
- **Idempotencia HTTP:** interceptor de `Idempotency-Key` en `POST /inquiries` y `POST /visits`.
- **OpenAPI:** `@nestjs/swagger` en `/docs`, igual a `contracts/openapi/visit-service.yaml`.

## Registro en Consul

Sigue la rule `service-discovery`.

- `ConsulRegistrationService` en `shared/discovery/` con el `fetch` nativo de Node.
- Registro en `main.ts` **después** de `await app.listen(...)`; un `setInterval` de 60 s lo repite.
- Baja: `app.enableShutdownHooks()` y `OnApplicationShutdown` (detiene el intervalo y después se da de baja).
- IP con `os.hostname()` + `dns.promises.lookup`, salvo `SERVICE_ADDRESS`.
- `GET /health` y `GET /health/ready` fuera de `/api/v1` (para `ready` sirve `@nestjs/terminus`).

## Comandos

```bash
npm ci
npm run start:dev
npm run test
npm run lint
npm run migration:generate -- src/database/migrations/<Nombre>
```

Usa `npm ci` (respeta el lockfile). No cambies de gestor ni borres `package-lock.json`. Tests con Jest; lint con ESLint + Prettier.

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `ddd-clean-architecture`, `api-rest`, `eventos-kafka` (en mensajería), `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`.
- **Skills:** `/scaffold-servicio visit` (una vez), `/caso-de-uso`, `/nuevo-endpoint`, `/nuevo-evento`, `/aplicar-patron` (State para `VisitStatus`, Specification para "se puede solicitar visita"), `/revisar`, `/crear-pr`.
- **Agente revisor:** `arquitecto-ddd` para dominio y políticas; `guardian-contratos` si cambian eventos u OpenAPI.
