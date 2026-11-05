# Progreso — visit-service

- **Responsable:** _(completar)_
- **En curso:** @JoseDani258 implementa el primer flujo de solicitudes de visita.
- **Stack:** NestJS
- **Instrucciones:** [`services/visit-service/CLAUDE.md`](../../services/visit-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Contrato inicial para solicitar y consultar visitas y esquemas de VisitRequested y LeadOpened | #39 |

## Pendientes

> @JoseDani258 está preparando la base local de Visit en una rama separada.

**Base**

- [ ] Scaffold con `/scaffold-servicio visit`
- [x] Contrato `contracts/openapi/visit-service.yaml`

**Consultas y visitas (enunciado)**

- [x] Snapshot local de propiedades: consumir `listing.property.events` (sin llamar a listing por HTTP)
- [ ] Enviar una consulta sobre una propiedad (`Inquiry`)
- [x] Solicitar una visita (`Visit` en `REQUESTED`, solo si la propiedad está `PUBLISHED`)
- [x] El cliente consulta el detalle y estado de una solicitud propia
- [ ] El agente revisa las consultas y solicitudes recibidas
- [x] Programar una visita pendiente con el agente asignado
- [ ] Rechazar, cancelar y completar visitas
- [x] Abrir la oportunidad (`Lead`) con la primera solicitud de visita (ADR 0005 sección 3.4)
- [ ] Abrir la oportunidad con la primera consulta
- [ ] Registrar el seguimiento del interesado y cerrar la oportunidad como `WON` o `LOST` (`Lead`)

**Eventos**

- [x] Publicador de `outbox` integrado en Visit

- [ ] Outbox: `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled`, `VisitCompleted`, `LeadOpened`, `LeadFollowUpRegistered`, `LeadClosed`
- [x] Proyección de propiedades idempotente (`processed_events`)

**Políticas (ADR 0005, secciones 3.2 y 3.3)**

- [ ] `PropertyReserved` → rechazar las visitas `REQUESTED` de esa propiedad (`reason: PROPERTY_RESERVED`, `actor: SYSTEM`)
- [ ] `PropertySold` / `PropertyRented` → rechazar las `REQUESTED` y cancelar las `SCHEDULED` futuras (`reason: PROPERTY_UNAVAILABLE`, `actor: SYSTEM`)
