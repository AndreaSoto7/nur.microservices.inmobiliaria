# Progreso — visit-service

- **Responsable:** _(completar)_
- **En curso:** @JoseDani258 prepara los contratos para solicitar una visita y consultar su detalle.
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

- [ ] Snapshot local de propiedades: consumir `listing.property.events` (sin llamar a listing por HTTP)
- [ ] Enviar una consulta sobre una propiedad (`Inquiry`)
- [ ] Solicitar una visita (`Visit` en `REQUESTED`, solo si la propiedad está `PUBLISHED`)
- [ ] El cliente consulta el estado de sus solicitudes
- [ ] El agente revisa las consultas y solicitudes recibidas
- [ ] Programar, rechazar, cancelar y completar visitas (máquina de estados de `Visit`)
- [ ] Abrir la oportunidad (`Lead`) con la primera consulta o solicitud de visita (política interna, ADR 0005 sección 3.4)
- [ ] Registrar el seguimiento del interesado y cerrar la oportunidad como `WON` o `LOST` (`Lead`)

**Eventos**

- [ ] Outbox: `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled`, `VisitCompleted`, `LeadOpened`, `LeadFollowUpRegistered`, `LeadClosed`
- [ ] Consumidores idempotentes (`processed_events`)

**Políticas (ADR 0005, secciones 3.2 y 3.3)**

- [ ] `PropertyReserved` → rechazar las visitas `REQUESTED` de esa propiedad (`reason: PROPERTY_RESERVED`, `actor: SYSTEM`)
- [ ] `PropertySold` / `PropertyRented` → rechazar las `REQUESTED` y cancelar las `SCHEDULED` futuras (`reason: PROPERTY_UNAVAILABLE`, `actor: SYSTEM`)
