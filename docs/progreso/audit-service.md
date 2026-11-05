# Progreso — audit-service

> **Opcional** ([ADR 0005](../adr/0005-realinear-servicios-y-cadenas-de-eventos.md), sección 5). Se empieza solo cuando las tres cadenas de eventos entre listing y visit funcionan.

- **Responsable:** _(completar)_
- **Stack:** por decidir (sugerencia: Go)
- **Instrucciones:** [`services/audit-service/CLAUDE.md`](../../services/audit-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Decidir stack y base de datos, y anotarlos en `CLAUDE.md`
- [ ] Scaffold con `/scaffold-servicio audit`
- [ ] Contrato `contracts/openapi/audit-service.yaml`

**Registro de eventos**

- [ ] Consumir todos los topics del catálogo desde el principio, idempotente por `eventId`
- [ ] Tabla solo de inserción con el envelope; el `payload` se guarda salvo en `identity.user.events`
- [ ] `GET /api/v1/audit/events` con filtros por `aggregateId`, `eventType` y fechas, solo `ADMIN`

**Depende de otros**

- identity publica `UserLoggedIn` y `UserRolesAssigned` ([identity-service.md](identity-service.md))
- Ruta `/api/v1/audit/**` en el gateway ([gateway.md](gateway.md))
