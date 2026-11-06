# Progreso — visit-service

- **Responsable:** _(completar)_
- **En curso:** @JoseDani258 implementa el primer flujo de solicitudes de visita.
- **Stack:** NestJS
- **Instrucciones:** [`services/visit-service/CLAUDE.md`](../../services/visit-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Contrato inicial para solicitar y consultar visitas y esquemas de VisitRequested y LeadOpened | #39 |
| feat | Rechazar visitas pendientes, registrar el motivo y emitir VisitRejected | Pendiente |
| feat | Cancelar visitas programadas antes del inicio y liberar el horario | Pendiente |
| feat | Marcar visitas realizadas al llegar la hora de fin y emitir VisitCompleted | Pendiente |
| feat | Enviar consultas sobre propiedades publicadas y abrir una oportunidad con el primer contacto | Pendiente |
| feat | Listar las consultas del agente y las visitas de cada participante, con filtros y paginación | Pendiente |

## Pendientes

> @JoseDani258 está preparando la base local de Visit en una rama separada.

**Base**

- [ ] Scaffold con `/scaffold-servicio visit`
- [x] Contrato `contracts/openapi/visit-service.yaml`

**Consultas y visitas (enunciado)**

- [x] Snapshot local de propiedades: consumir `listing.property.events` (sin llamar a listing por HTTP)
- [x] Enviar una consulta sobre una propiedad (`Inquiry`)
- [x] Solicitar una visita (`Visit` en `REQUESTED`, solo si la propiedad está `PUBLISHED`)
- [x] El cliente consulta el detalle y estado de una solicitud propia
- [x] El agente lista sus consultas y visitas asignadas; el cliente lista sus propias visitas
- [x] Programar una visita pendiente con el agente asignado
- [x] Rechazar una visita pendiente con motivo obligatorio, por el agente asignado
- [x] Cancelar una visita programada antes del inicio, por el cliente o agente asignado
- [x] Completar una visita programada al llegar o pasar la hora de fin, por el agente asignado
- [x] Abrir la oportunidad (`Lead`) con la primera solicitud de visita (ADR 0005 sección 3.4)
- [x] Abrir la oportunidad con la primera consulta si no existe una abierta
- [ ] Registrar el seguimiento del interesado y cerrar la oportunidad como `WON` o `LOST` (`Lead`)

**Eventos**

- [x] Publicador de `outbox` integrado en Visit

- [x] Outbox: `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled`, `VisitCompleted` y `LeadOpened`
- [ ] Outbox: `LeadFollowUpRegistered`, `LeadClosed`
- [x] Proyección de propiedades idempotente (`processed_events`)

**Políticas (ADR 0005, secciones 3.2 y 3.3)**

- [ ] `PropertyReserved` → rechazar las visitas `REQUESTED` de esa propiedad (`reason: PROPERTY_RESERVED`, `actor: SYSTEM`)
- [ ] `PropertySold` / `PropertyRented` → rechazar las `REQUESTED` y cancelar las `SCHEDULED` futuras (`reason: PROPERTY_UNAVAILABLE`, `actor: SYSTEM`)
