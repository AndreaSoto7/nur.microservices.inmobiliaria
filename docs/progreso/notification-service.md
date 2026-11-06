# Progreso — notification-service

- **Responsable:** _(completar)_
- **Stack:** Go
- **Instrucciones:** [`services/notification-service/CLAUDE.md`](../../services/notification-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| docs | ADR 0007: se retoma el servicio, con avisos solo dentro de la app. Diseño, base y progreso | este PR |

## Pendientes

**Base**

- [ ] Contrato `contracts/openapi/notification-service.yaml` y consumidores en `contracts/events/README.md`
- [ ] Scaffold: capas, health, Consul, problem+json, correlation-id, Dockerfile y lint
- [ ] Servicio y base en el compose

**Avisos (enunciado: solicitudes, visitas y cambios relevantes)**

- [ ] Dominio: `Notification`, con sus reglas y tests
- [ ] Casos de uso: `NotifyOnEvent`, `MarkNotificationRead` y `ListNotifications`
- [ ] Persistencia y API: listar mis avisos y marcarlos como leídos
- [ ] Consumir `UserRegistered`, `VisitRequested` y `PropertyReserved` (idempotente, con DLQ)

**Depende de otros**

- Schemas de `InquiryReceived`, `VisitScheduled`, `VisitRejected` y `VisitCancelled` ([visit-service.md](visit-service.md)). Cuando existan, se agrega su aviso.
- Pantalla de avisos ([frontend.md](frontend.md)).
- Ruta `/api/v1/notifications/**` en el gateway: hecha en #71.
