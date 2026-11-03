# Progreso — visit-service

- **Responsable:** _(completar)_
- **Stack:** NestJS
- **Rules:** `stack-nestjs`, `ddd-clean-architecture`, `eventos-kafka`, `service-discovery`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Scaffold con `/scaffold-servicio visit`
- [ ] Contrato `contracts/openapi/visit-service.yaml`

**Consultas y visitas (enunciado)**

- [ ] Snapshot local de propiedades: consumir `listing.property.events` (sin llamar a listing por HTTP)
- [ ] Enviar una consulta sobre una propiedad (`Inquiry`)
- [ ] Solicitar una visita (`Visit` en `REQUESTED`, solo si la propiedad está `PUBLISHED`)
- [ ] El cliente consulta el estado de sus solicitudes
- [ ] El agente revisa las consultas y solicitudes recibidas
- [ ] Programar, rechazar, cancelar y completar visitas (máquina de estados de `Visit`)
- [ ] Registrar el seguimiento del interesado (`Lead`)

**Eventos**

- [ ] Outbox: `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled`, `VisitCompleted`
- [ ] Consumidores idempotentes (`processed_events`)
