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
| feat | Listar oportunidades del agente y registrar notas de seguimiento | Pendiente |
| feat | Cerrar oportunidades como ganadas o perdidas y emitir LeadClosed | Pendiente |
| feat | Aplicar las políticas de reserva, venta y alquiler de Listing a las visitas | Pendiente |
| docs | Contrato: `propertyTitle` opcional en la visita | #111 |

## Pendientes

> @JoseDani258 está preparando la base local de Visit en una rama separada.

**Base**

- [ ] Scaffold con `/scaffold-servicio visit`
- [x] Primera migración de PostgreSQL para las tablas de Visit y las claves de idempotencia
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
- [x] Listar oportunidades asignadas y registrar notas mientras estén abiertas
- [x] Cerrar la oportunidad como `WON` o `LOST`

**Eventos**

- [x] Publicador de `outbox` integrado en Visit

- [x] Outbox: `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled`, `VisitCompleted`, `LeadOpened`, `LeadFollowUpRegistered` y `LeadClosed`
- [x] Proyección de propiedades idempotente (`processed_events`)

**Políticas (ADR 0005, secciones 3.2 y 3.3)**

- [x] `PropertyReserved` → rechazar las visitas `REQUESTED` de esa propiedad (`reason: PROPERTY_RESERVED`, `actor: SYSTEM`)
- [x] `PropertySold` / `PropertyRented` → rechazar las `REQUESTED` y cancelar las `SCHEDULED` futuras (`reason: PROPERTY_UNAVAILABLE`, `actor: SYSTEM`)

**Verificación de integración**

- [x] Visit y Listing real (copia local de main, a9978a6), con Kafka y dos bases PostgreSQL temporales. Listing publicó una propiedad y Visit la recibió. Al cerrar una oportunidad como WON, Listing la reservó; Visit rechazó 2 solicitudes pendientes y mantuvo 1 visita programada. Al vender la propiedad en Listing, Visit canceló esa visita futura. Se usaron JWT de prueba con un JWKS temporal.
- [x] Gateway e Identity de main (384a8a1), Visit y Consul en Docker con PostgreSQL temporal. Registro e inicio de sesión por el Gateway con tokens reales de Identity. Con una propiedad de prueba en la copia local, el cliente solicitó y consultó su visita y el agente asignado la programó. Sin access token o con refresh token se obtuvo 401, con un rol sin permiso 403 y para un cliente ajeno 404. Se comprobó el registro automático de Visit y su baja al apagar.
