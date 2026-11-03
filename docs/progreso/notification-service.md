# Progreso — notification-service

- **Responsable:** _(completar)_
- **Stack:** Go
- **Rules:** `stack-go`, `ddd-clean-architecture`, `eventos-kafka`, `service-discovery`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Decidir la base de datos (ADR pendiente: PostgreSQL vs. MongoDB)
- [ ] Scaffold con `/scaffold-servicio notification`
- [ ] Contrato `contracts/openapi/notification-service.yaml`

**Notificaciones (enunciado: avisos ante solicitudes, visitas y cambios)**

- [ ] Decidir a quién se avisa en los eventos de propiedad: el payload solo identifica al agente y favoritos no publica eventos
- [ ] Consumir los eventos de visit y listing (idempotente) y crear notificaciones
- [ ] Canales con Strategy: in-app, email simulado y log
- [ ] Listar mis notificaciones y marcarlas como leídas
