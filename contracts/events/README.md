# Catálogo de eventos de integración (Kafka)

Esta es la fuente de verdad de los eventos entre servicios. Si un evento no está aquí, no existe. Cualquier cambio entra primero por PR a esta carpeta, revisado por los responsables de los servicios consumidores (ver `.claude/rules/eventos-kafka.md` y la skill `/nuevo-evento`).

## Convenciones

- **Envelope común:** [`envelope.schema.json`](envelope.schema.json). Acepta campos adicionales (`additionalProperties: true`): agregar un campo opcional al envelope no rompe a los consumidores, que deben ignorar los campos que no conocen.
- **Payload:** `<servicio>/<evento-kebab>.v<N>.schema.json` (JSON Schema 2020-12).
- **Topic:** `<servicio>.<aggregate>.events`. Clave del mensaje: `aggregateId`.
- **DLQ:** `<topic>.dlq`. Consumer group: el nombre del servicio consumidor.
- **Versiones:** el consumidor filtra por `(eventType, eventVersion)` e ignora las versiones que no conoce.
- **Retención:** `listing.property.events` no expira (`retention.ms=-1`): visit arranca desde el principio y puede reconstruir su copia de las propiedades. `identity.user.events` usa la retención por defecto, porque lleva email y nombre: no se guardan datos personales para siempre. Los topics de visit también usan la retención por defecto.
- **Punto de arranque:** visit, listing, notification y audit arrancan desde el principio del topic (`earliest`). Sus consumidores son idempotentes y las reglas de estado descartan los eventos viejos.

## Topics

| Topic | Productor | Aggregate | Consumidores |
|---|---|---|---|
| `identity.user.events` | identity-service | User | notification, audit* |
| `listing.property.events` | listing-service | Property | visit, notification, audit* |
| `visit.inquiry.events` | visit-service | Inquiry | audit* |
| `visit.visit.events` | visit-service | Visit | notification, audit* |
| `visit.lead.events` | visit-service | Lead | listing, audit* |

\* `audit-service` es opcional ([ADR 0005](../../docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md), sección 5). Si no se construye, esos topics quedan sin ese consumidor.

## Eventos

| Evento | v | Topic | Productor | Consumidores | Cuándo |
|---|---|---|---|---|---|
| `UserRegistered` | 1 | identity.user.events | identity | notification, audit* | Se registra un usuario |
| `UserLoggedIn` | 1 | identity.user.events | identity | audit* | Un usuario inicia sesión. **Solo se publica si se construye audit-service** |
| `UserRolesAssigned` | 1 | identity.user.events | identity | audit* | El administrador asigna roles. **Solo se publica si se construye audit-service** |
| `PropertyPublished` | 1 | listing.property.events | listing | visit, audit* | Una propiedad pasa a `PUBLISHED` (también al reanudar o liberar una reserva) |
| `PropertyUpdated` | 1 | listing.property.events | listing | visit, audit* | Se editan los datos, las características o la galería de una propiedad publicada o reservada (un solo evento por comando) |
| `PropertyPaused` | 1 | listing.property.events | listing | visit, audit* | Una propiedad pasa a `PAUSED` |
| `PropertyReserved` | 1 | listing.property.events | listing | visit, notification, audit* | Una propiedad pasa a `RESERVED` |
| `PropertySold` | 1 | listing.property.events | listing | visit, audit* | Una propiedad pasa a `SOLD` |
| `PropertyRented` | 1 | listing.property.events | listing | visit, audit* | Una propiedad pasa a `RENTED` |
| `InquiryReceived` | 1 | visit.inquiry.events | visit | audit* | Un interesado envía una consulta |
| `VisitRequested` | 1 | visit.visit.events | visit | notification, audit* | Un interesado solicita una visita |
| `VisitScheduled` | 1 | visit.visit.events | visit | audit* | El agente programa la visita |
| `VisitRejected` | 1 | visit.visit.events | visit | audit* | El agente rechaza la solicitud, o el sistema la rechaza porque la propiedad se reservó, vendió o alquiló |
| `VisitCancelled` | 1 | visit.visit.events | visit | audit* | El cliente o el agente cancela, o el sistema la cancela porque la propiedad se vendió o alquiló |
| `VisitCompleted` | 1 | visit.visit.events | visit | audit* | La visita se realizó |
| `LeadOpened` | 1 | visit.lead.events | visit | audit* | Una consulta o solicitud de visita abre una oportunidad |
| `LeadFollowUpRegistered` | 1 | visit.lead.events | visit | audit* | El agente registra un seguimiento de la oportunidad |
| `LeadClosed` | 1 | visit.lead.events | visit | listing, audit* | El agente cierra la oportunidad como ganada (`WON`) o perdida (`LOST`) |

## Políticas: eventos que desencadenan comandos en otro servicio

Detalle y reglas en el [ADR 0005](../../docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md), sección 3.

| Cuando llega… | Servicio que reacciona | Comando | Evento resultante |
|---|---|---|---|
| `LeadClosed` con `outcome: WON` | listing | `ReservePropertyCommand` (solo si está `PUBLISHED` y el agente coincide) | `PropertyReserved` |
| `PropertyReserved` | visit | `RejectVisitCommand` por cada visita `REQUESTED` (`reason: PROPERTY_RESERVED`) | `VisitRejected` |
| `PropertySold` / `PropertyRented` | visit | `RejectVisitCommand` por cada `REQUESTED` y `CancelVisitCommand` por cada `SCHEDULED` futura (`reason: PROPERTY_UNAVAILABLE`) | `VisitRejected` / `VisitCancelled` |

## Avisos: eventos que crean notificaciones

`notification-service` solo consume ([ADR 0007](../../docs/adr/0007-retomar-notification-service.md)). Del payload lee únicamente lo que necesita: de `UserRegistered`, solo `userId`.

| Cuando llega… | Destinatario | Tipo de aviso |
|---|---|---|
| `UserRegistered` | `userId` | `WELCOME` |
| `VisitRequested` | `agentId` | `VISIT_REQUESTED` |
| `PropertyReserved` con `actor: SYSTEM` | `agentId` | `PROPERTY_RESERVED` |

Cuando visit defina los schemas de `InquiryReceived`, `VisitScheduled`, `VisitRejected` y `VisitCancelled`, notification agrega su aviso. Necesita que lleven `agentId` o `clientId`, según a quién se avisa.

## Schemas definidos

- [x] `identity/user-registered.v1.schema.json`
- [x] listing: [`property-updated`](listing/property-updated.v1.schema.json), [`property-paused`](listing/property-paused.v1.schema.json), [`property-reserved`](listing/property-reserved.v1.schema.json), [`property-sold`](listing/property-sold.v1.schema.json) y [`property-rented`](listing/property-rented.v1.schema.json) (v1). `PropertyPublished` ganó el campo opcional `previousStatus` (`DRAFT`, `PAUSED` o `RESERVED`), que listing siempre envía
- [x] `listing/property-published.v1.schema.json` (ejemplo de referencia; el responsable de listing puede ajustarlo antes de la primera implementación)
- [x] [`visit/visit-requested.v1.schema.json`](visit/visit-requested.v1.schema.json)
- [x] [`visit/lead-opened.v1.schema.json`](visit/lead-opened.v1.schema.json)
- [ ] El resto se crea con `/nuevo-evento` cuando el servicio productor lo implemente.
