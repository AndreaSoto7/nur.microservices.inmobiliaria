# 0005 — Realinear los servicios al event storming y encadenar eventos entre listing y visit

- **Estado:** Propuesto
- **Fecha:** 2026-11-04
- **Autores:** @JairoSolizOrtiz1
- **Modifica:** [0001](0001-arquitectura-y-stack.md) (tabla de servicios)
- **Modificado por:** [0007](0007-retomar-notification-service.md) (`notification-service` vuelve al alcance)

## Contexto

- **Poco tiempo.** El equipo cerró un event storming reducido con tres servicios: identity, listing y visit (lead/visit). El ADR 0001 planeaba cinco; search-service y notification-service no tienen código ni responsable.
- **Lo que más va a mirar el docente** es el uso de eventos y del broker. En particular, que **un evento publicado por un servicio desencadene comandos en otro**.
- **El event storming no tiene ninguna política entre servicios.** Las cajas lilas son invariantes de cada aggregate. Sin search ni notification, casi ningún evento tendría consumidor, y Kafka no tendría justificación.
- **El enunciado exige** eventos y "CQRS donde sea pertinente". Nombra eventos como `PropertyPublished`, `VisitScheduled`, `PropertyReserved` y `PropertySold`.
- **Los nombres del diagrama** (`ListingSold`, `VisitProgrammed`, `consultationSent`, …) no coinciden con el lenguaje ubicuo de `CLAUDE.md` ni con el catálogo de `contracts/events/`.

## Opciones consideradas

1. **Mantener los cinco servicios del ADR 0001.**
   - Pros: CQRS entre servicios con search; avisos con notification.
   - Contras: no hay tiempo ni responsables para dos servicios más.
2. **Solo los tres servicios del diagrama, tal cual.**
   - Pros: el alcance más chico.
   - Contras: cada servicio publica eventos que nadie consume. El broker queda de adorno, justo en el criterio que más se evalúa.
3. **Los tres servicios del diagrama, más políticas que encadenan eventos entre listing y visit, usando solo comandos que ya están en el diagrama. Auditoría opcional al final.**
   - Pros:
     - No agrega comandos: conecta eventos existentes con comandos existentes.
     - Los eventos viajan en los dos sentidos (visit → listing → visit), sin llamadas HTTP.
   - Contras:
     - listing pasa a consumir eventos (antes solo producía).
     - La reserva por una oportunidad ganada es eventualmente consistente.

## Decisión

Se elige la **opción 3**.

### 1. Servicios en alcance

| Servicio | Estado | Nota |
|---|---|---|
| `identity-service` | En alcance | Sin cambios |
| `listing-service` | En alcance | Además, consume `visit.lead.events` y sirve el catálogo público con filtros |
| `visit-service` | En alcance | Consultas, visitas y oportunidades (`Lead`) |
| `audit-service` | **Opcional** | Solo cuando las tres cadenas funcionen (sección 5) |
| `search-service` | Fuera de alcance | Se retoma solo si sobra tiempo, con un ADR propio |
| `notification-service` | Fuera de alcance | Se retoma solo si sobra tiempo, con un ADR propio |

### 2. Nombres: del diagrama al código

En el código y en los contratos manda el lenguaje ubicuo de `CLAUDE.md`. El diagrama se queda como está; esta tabla traduce sus nombres.

Columna **Kafka**: si el hecho se publica como evento de integración. "Interno" significa evento de dominio, solo dentro del servicio.

**identity-service**

| Comando (diagrama) | Comando (código) | Evento (diagrama) | Evento (código) | Kafka |
|---|---|---|---|---|
| `registerUserCommand` | `RegisterUserCommand` (ya existe) | `RegisteredUser` | `UserRegistered` | Sí (ya existe) |
| `loginCommand` | `AuthenticateUserCommand` (ya existe) | `UserLoggedIn` | `UserLoggedIn` | Solo con auditoría |
| `assignRoleCommand` | `AssignUserRolesCommand` | `RolesAssigned` | `UserRolesAssigned` | Solo con auditoría |

Roles del diagrama: Interesado = `CLIENT`, Agente = `AGENT`, Administrador = `ADMIN`.

**listing-service** (en el diagrama, "Listing"; en código, `Property`)

| Comando (diagrama) | Comando (código) | Evento (diagrama) | Evento (código) | Kafka |
|---|---|---|---|---|
| `createListingCommand` | `CreatePropertyCommand` | `ListingCreated` | `PropertyCreated` | Interno (una propiedad en `DRAFT` no le importa a nadie) |
| `registerPropertiesCommand` | `UpdatePropertyFeaturesCommand` | `PropertyFeacturesUpdated` | `PropertyFeaturesUpdated` | Interno; si la propiedad está `PUBLISHED` o `RESERVED`, se publica `PropertyUpdated` |
| `publishListingCommand` | `PublishPropertyCommand` | `ListingPublished` | `PropertyPublished` | Sí |
| `editListingCommand` | `EditPropertyCommand` | `ListingUpdated` | `PropertyUpdated` | Sí, si está `PUBLISHED` o `RESERVED` |
| `pauseListingCommand` | `PausePropertyCommand` | `ListingPaused` | `PropertyPaused` | Sí |
| `reserveListingCommand` | `ReservePropertyCommand` | `ListinReserved` | `PropertyReserved` | Sí |
| `cancelListingCommand` | `ReleaseReservationCommand` | `ListingReservationCancelled` | `PropertyPublished` con `previousStatus: RESERVED` | Sí (máquina de estados de la rule `ddd-clean-architecture`) |
| `buyListingCommand` | `MarkPropertySoldCommand` | `ListingSold` | `PropertySold` | Sí |
| `rentListingCommand` | `MarkPropertyRentedCommand` | `ListingRented` | `PropertyRented` | Sí |
| `updateGalleryCommand` | `AddPropertyImagesCommand` | `GalleryImagesAdded` | `PropertyImagesAdded` | Interno |

`buyListing` pasa a `MarkPropertySold`: nadie compra dentro del sistema (los pagos están fuera de alcance); el agente registra el resultado.

**visit-service**

| Comando (diagrama) | Comando (código) | Evento (diagrama) | Evento (código) | Kafka |
|---|---|---|---|---|
| `sendConsultationCommand` | `SendInquiryCommand` | `consultationSent` | `InquiryReceived` | Sí |
| `requestVisitCommand` | `RequestVisitCommand` | `VisitRequested` | `VisitRequested` | Sí |
| `programVisitCommand` | `ScheduleVisitCommand` | `VisitProgrammed` | `VisitScheduled` | Sí |
| `declineVisitCommand` | `RejectVisitCommand` | `VisitRequestDeclined` | `VisitRejected` | Sí |
| `cancelVisitCommand` | `CancelVisitCommand` | `VisitCancelled` | `VisitCancelled` | Sí |
| `registerVisitConcludedCommand` | `CompleteVisitCommand` | `VisitConcluded` | `VisitCompleted` | Sí |
| _(política interna, ver 3.4)_ | `OpenLeadCommand` | — | `LeadOpened` | Sí |
| `registerVisitTracing` | `RegisterLeadFollowUpCommand` | `VisitTracingRegistered` | `LeadFollowUpRegistered` | Sí |
| `closeOportunityCommand` | `CloseLeadCommand` | `OpportunityClosed` | `LeadClosed` (`outcome`: `WON` o `LOST`) | Sí; **lo consume listing** |

El seguimiento y el cierre actúan sobre el aggregate `Lead`, no sobre `Visit`.

### 3. Políticas: los eventos que desencadenan comandos

Requisito previo de todas: **visit guarda una copia local de cada propiedad** (`propertyId`, `agentId`, `status`, `operationType`, `title`). La alimenta con `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold` y `PropertyRented`. Así valida "la propiedad debe estar publicada" y "solo el agente asignado" sin llamar a listing por HTTP.

**Reglas comunes a las políticas:**

- Una política es un handler de la capa de aplicación. El consumidor Kafka (infraestructura) traduce el evento a un comando propio y lo envía al mismo handler que usa la API.
- El comando lleva `actor: SYSTEM` y un motivo fijo. Se salta la regla "solo el agente…", pero **no** las reglas de estado del aggregate.
- Si una regla de estado rechaza el comando, el consumidor lo registra en el log con nivel `WARN` y sigue. No va a la DLQ: la DLQ es para errores técnicos, no para reglas de negocio.
- **No hay ciclos.** listing solo consume `LeadClosed`, y las reacciones de visit producen eventos de `Visit`, que listing no consume.

#### 3.1 Una oportunidad ganada reserva la propiedad (visit → listing)

`CloseLeadCommand` → `LeadClosed` (`outcome: WON`) → *Política en listing: "una oportunidad ganada reserva la propiedad"* → `ReservePropertyCommand` → `PropertyReserved`

- listing ignora `outcome: LOST`.
- Reserva solo si la propiedad está `PUBLISHED` y si el `agentId` del evento es el agente de la propiedad. Si no, no reserva (por ejemplo, otra oportunidad ganó antes) y deja el `WARN`. La oportunidad sigue cerrada como ganada y el agente lo resuelve a mano. No hay evento de compensación (YAGNI).

#### 3.2 Una propiedad reservada rechaza las solicitudes pendientes (listing → visit)

`PropertyReserved` → *Política en visit: "una propiedad reservada no recibe más visitas"* → `RejectVisitCommand` por cada visita `REQUESTED` de esa propiedad, con `reason: PROPERTY_RESERVED` → `VisitRejected`

Las visitas `SCHEDULED` se mantienen, porque la reserva todavía puede liberarse.

#### 3.3 Una propiedad vendida o alquilada cancela sus visitas (listing → visit)

`PropertySold` / `PropertyRented` → *Política en visit: "una propiedad no disponible no tiene visitas"*:

- `RejectVisitCommand` por cada visita `REQUESTED`, con `reason: PROPERTY_UNAVAILABLE` → `VisitRejected`.
- `CancelVisitCommand` por cada visita `SCHEDULED` con fecha futura, con `reason: PROPERTY_UNAVAILABLE` → `VisitCancelled`.
- Las visitas `SCHEDULED` cuya fecha ya pasó quedan para que el agente las registre como concluidas.

#### 3.4 Una consulta o solicitud abre la oportunidad (interna de visit)

`InquiryReceived` / `VisitRequested` → *Política: "todo contacto abre una oportunidad"* → `OpenLeadCommand`, solo si no hay un `Lead` abierto para ese cliente y esa propiedad → `LeadOpened`

Es interna: se resuelve con eventos de dominio dentro de visit, no pasa por Kafka. Sin ella, `registerVisitTracing` y `closeOportunity` no tendrían sobre qué actuar.

#### Recorrido para la demo

1. El agente cierra una oportunidad como ganada → `LeadClosed`.
2. listing reserva la propiedad → `PropertyReserved`.
3. visit rechaza las demás solicitudes pendientes → `VisitRejected` × N.
4. El agente marca la propiedad como vendida → `PropertySold`.
5. visit cancela las visitas programadas → `VisitCancelled` × N.

### 4. Topics

- Se agrega `visit.lead.events` (aggregate `Lead`, clave `leadId`, retención por defecto).
- **listing-service** consume `visit.lead.events` con el consumer group `listing-service`, desde el principio (`earliest`). Un evento repetido o viejo es inofensivo: el consumidor es idempotente (`processed_events`) y la regla "solo si está `PUBLISHED`" lo descarta.
- **visit-service** sigue consumiendo `listing.property.events` desde el principio.

### 5. Auditoría (opcional)

Se construye **solo si las tres cadenas ya funcionan**. No agrega cadenas (solo consume), pero:

- da consumidor a los eventos de identity, que sin ella nadie escucha;
- demuestra el beneficio del broker: se agrega un servicio sin tocar a los productores.

**Cómo sería:**

- Consume todos los topics con el consumer group `audit-service`, desde el principio, de forma idempotente por `eventId`.
- Guarda en una tabla **solo de inserción** (sin `UPDATE` ni `DELETE`) el envelope: `eventId`, `eventType`, `eventVersion`, `producer`, `aggregateType`, `aggregateId`, `correlationId`, `occurredAt` y la fecha de recepción.
- Guarda el `payload` de todos los topics **excepto** `identity.user.events`, que lleva email y nombre.
- Expone `GET /api/v1/audit/events` con filtros por `aggregateId`, `eventType` y rango de fechas, solo para `ADMIN`.
- Con auditoría, identity publica también `UserLoggedIn` y `UserRolesAssigned`, sin email ni nombre: `userId` y, en el segundo, los roles.
- Stack, base de datos y responsable se deciden en el PR que lo arranque. Sugerencia: Go (las convenciones de Go están en `gateway/CLAUDE.md`) y PostgreSQL.

### 6. CQRS sin search-service

- **Dentro de listing:** el lado comando es el aggregate `Property`. El lado consulta (catálogo público con filtros por zona, tipo, precio y características) son query handlers que leen una proyección de lectura propia, sin pasar por el dominio.
- **Entre servicios:** la copia local de propiedades en visit es un modelo de lectura alimentado por eventos.
- Ruta propuesta del catálogo: `/api/v1/catalog/**` → listing (pública). Se confirma en `contracts/openapi/listing-service.yaml` con `/nuevo-endpoint`.

## Justificación

- **Cumple el criterio que más se evalúa con el menor trabajo:** tres políticas, sin comandos nuevos, y los eventos cruzan el broker en los dos sentidos.
- **Respeta la regla de oro 2:** ningún servicio llama a otro por HTTP; visit valida con su copia local y listing reacciona a un evento.
- **DDD:** cada política modifica un solo aggregate por transacción, y las reglas de estado siguen dentro del aggregate dueño. El servicio que reacciona decide, no el que publica.
- **Nombres del lenguaje ubicuo:** coinciden con el enunciado (`VisitScheduled`, `PropertySold`, …) y con el catálogo ya publicado; no hay que versionar nada.
- **KISS:** search y notification salen; la auditoría queda condicionada a que sobre tiempo.

## Consecuencias

- **Se gana:**
  - Cadenas de eventos demostrables entre listing y visit, en los dos sentidos.
  - Dos servicios menos que construir.
- **Se pierde o se asume:**
  - Consistencia eventual: entre `LeadClosed` y `PropertyReserved` pasa un instante en que la propiedad sigue publicada.
  - Si dos oportunidades de la misma propiedad se ganan casi a la vez, solo la primera reserva; la otra queda para resolver a mano.
  - Sin notification no hay avisos: el cliente ve el estado de sus solicitudes en la app.
  - listing carga con el catálogo público y con un consumidor Kafka.
- **Hay que hacer ahora:**
  - [x] Catálogo de eventos (`contracts/events/README.md`): topic `visit.lead.events`, eventos de `Lead`, consumidores y políticas (este PR).
  - [x] `CLAUDE.md`, `docs/enunciado.md` y `docs/progreso/`: servicios en alcance y tareas nuevas (este PR).
  - [x] `infra/scripts/init-topics.sh`: crear `visit.lead.events` (este PR).
  - [ ] Schemas de cada evento con `/nuevo-evento`, cuando el productor lo implemente. `VisitRejected` y `VisitCancelled` llevan `reason` y `actor` (`CLIENT`, `AGENT` o `SYSTEM`). `LeadClosed` lleva `propertyId`, `agentId`, `clientId` y `outcome`.
  - [x] Gateway: tabla de rutas sin search ni notification y con `/api/v1/catalog/**` y `/api/v1/audit/**` (`gateway/CLAUDE.md`, rule `api-rest`). El ruteo en código todavía no existe.
  - [x] Rules, skills y agentes de `.claude/` sin search ni notification; instrucciones por componente en su propio `CLAUDE.md`.
  - [ ] Al implementar cada política, registrarla en `docs/patrones-de-diseno.md`.
