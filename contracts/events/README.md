# Catálogo de eventos de integración (Kafka)

Esta es la fuente de verdad de los eventos entre servicios. Si un evento no está aquí, no existe. Cualquier cambio entra primero por PR a esta carpeta, revisado por los responsables de los servicios consumidores (ver `.claude/rules/eventos-kafka.md` y la skill `/nuevo-evento`).

## Convenciones

- **Envelope común:** [`envelope.schema.json`](envelope.schema.json).
- **Payload:** `<servicio>/<evento-kebab>.v<N>.schema.json` (JSON Schema 2020-12).
- **Topic:** `<servicio>.<aggregate>.events`. Clave del mensaje: `aggregateId`.
- **DLQ:** `<topic>.dlq`. Consumer group: el nombre del servicio consumidor.

## Topics

| Topic | Productor | Aggregate |
|---|---|---|
| `identity.user.events` | identity-service | User |
| `listing.property.events` | listing-service | Property |
| `visit.inquiry.events` | visit-service | Inquiry |
| `visit.visit.events` | visit-service | Visit |

## Eventos

| Evento | v | Topic | Productor | Consumidores | Cuándo |
|---|---|---|---|---|---|
| `UserRegistered` | 1 | identity.user.events | identity | notification | Se registra un usuario |
| `PropertyPublished` | 1 | listing.property.events | listing | search, visit, notification | Una propiedad pasa a `PUBLISHED` (también al reanudar o liberar una reserva) |
| `PropertyUpdated` | 1 | listing.property.events | listing | search, visit | Se editan los datos de una propiedad publicada |
| `PropertyPaused` | 1 | listing.property.events | listing | search, visit | Una propiedad pasa a `PAUSED` |
| `PropertyReserved` | 1 | listing.property.events | listing | search, visit, notification | Una propiedad pasa a `RESERVED` |
| `PropertySold` | 1 | listing.property.events | listing | search, visit, notification | Una propiedad pasa a `SOLD` |
| `PropertyRented` | 1 | listing.property.events | listing | search, visit, notification | Una propiedad pasa a `RENTED` |
| `InquiryReceived` | 1 | visit.inquiry.events | visit | notification | Un interesado envía una consulta |
| `VisitRequested` | 1 | visit.visit.events | visit | notification | Un interesado solicita una visita |
| `VisitScheduled` | 1 | visit.visit.events | visit | notification | El agente programa la visita |
| `VisitRejected` | 1 | visit.visit.events | visit | notification | El agente rechaza la solicitud |
| `VisitCancelled` | 1 | visit.visit.events | visit | notification | El cliente o el agente cancela |
| `VisitCompleted` | 1 | visit.visit.events | visit | notification | La visita se realizó |

## Schemas definidos

- [x] `listing/property-published.v1.schema.json` (ejemplo de referencia; el responsable de listing puede ajustarlo antes de la primera implementación)
- [ ] El resto se crea con `/nuevo-evento` cuando el servicio productor lo implemente.
