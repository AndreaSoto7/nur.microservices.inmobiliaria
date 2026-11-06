# Progreso — notification-service

- **Responsable:** _(completar)_
- **Stack:** Go
- **Instrucciones:** [`services/notification-service/CLAUDE.md`](../../services/notification-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| docs | ADR 0007: se retoma el servicio, con avisos solo dentro de la app. Diseño, base y progreso | #73 |
| feat | Contrato OpenAPI (listar y marcar como leído) y consumidores en el catálogo de eventos | #74 |
| chore | Scaffold: config, `/health` y `/health/ready`, registro en Consul con baja, problem+json, correlation-id, logs JSON, Dockerfile y lint | #75 |
| feat | Dominio (`Notification`) y casos de uso: políticas ante eventos, marcar como leído y listar | #76 |
| feat | Persistencia: migraciones con advisory lock y repositorio con pgx, con el aviso y el evento en una sola transacción | #77 |
| fix | Test inestable de paginación: el repositorio falso no desempataba el orden, a diferencia del real | #78 |
| feat | Validación del access token con el JWKS de identity, con caché, recarga limitada y renovación cada 5 minutos | este PR |

## Pendientes

**Base**

- [x] Contrato `contracts/openapi/notification-service.yaml` y consumidores en `contracts/events/README.md`
- [x] Scaffold: capas, health, Consul, problem+json, correlation-id, Dockerfile y lint
- [ ] Servicio y base en el compose

**Avisos (enunciado: solicitudes, visitas y cambios relevantes)**

- [x] Dominio: `Notification`, con sus reglas y tests
- [x] Casos de uso: `NotifyOnEvent`, `MarkNotificationRead` y `ListNotifications`
- [ ] Persistencia y API: listar mis avisos y marcarlos como leídos
- [ ] Consumir `UserRegistered`, `VisitRequested` y `PropertyReserved` (idempotente, con DLQ)

**Depende de otros**

- Schemas de `InquiryReceived`, `VisitScheduled`, `VisitRejected` y `VisitCancelled` ([visit-service.md](visit-service.md)). Cuando existan, se agrega su aviso.
- Pantalla de avisos ([frontend.md](frontend.md)).
- Ruta `/api/v1/notifications/**` en el gateway: hecha en #71.
