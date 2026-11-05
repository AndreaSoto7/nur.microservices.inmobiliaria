# audit-service — opcional (stack por decidir)

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica.

> **Se empieza solo cuando las tres cadenas de eventos entre listing y visit funcionan** (ADR 0005, sección 5). Antes de escribir código, el responsable decide el stack y completa las secciones marcadas _(por decidir)_ en el mismo PR del scaffold.

## Ficha

| | |
|---|---|
| Responsable | _(completar)_ |
| Stack | _(por decidir)_. Sugerencia: Go, como el gateway |
| Puerto | 8004 |
| Base | `audit` (PostgreSQL 17) → [`docs/base-de-datos/audit-service.md`](../../docs/base-de-datos/audit-service.md) |
| API | `contracts/openapi/audit-service.yaml` (por crear) |
| Ruta del gateway | `/api/v1/audit/**` (solo `ADMIN`) |
| Publica | Nada |
| Consume | Todos los topics del catálogo |
| Progreso | [`docs/progreso/audit-service.md`](../../docs/progreso/audit-service.md) |

## Qué hace y qué no

- **Hace:** guarda cada evento que pasa por Kafka en un registro de solo inserción y lo deja consultar al `ADMIN`.
- **No hace:** reaccionar a eventos con comandos ni publicar nada. No es un dominio rico: su valor es mostrar que se agrega un consumidor **sin tocar a los productores**.

## Comportamiento

- Consumer group `audit-service`, desde el principio de cada topic.
- `INSERT ... ON CONFLICT (event_id) DO NOTHING`: la clave primaria es la idempotencia (no hace falta `processed_events`).
- Guarda el envelope completo y el `payload`, **salvo en `identity.user.events`** (email y nombre: solo el envelope).
- Un mensaje que no cumple el envelope va a la DLQ de su topic.
- `GET /api/v1/audit/events?aggregateId=&eventType=&from=&to=` con paginación (rule `api-rest`), solo `ADMIN`.
- Con auditoría, identity publica también `UserLoggedIn` y `UserRolesAssigned` (ver `services/identity-service/CLAUDE.md`).

## Estructura, comandos y registro en Consul

_(por decidir con el stack)_. Debe respetar las capas de la rule `ddd-clean-architecture` y el contrato de la rule `service-discovery`. Si se elige Go, tomar como base las convenciones de Go de `gateway/CLAUDE.md` (`context.Context`, errores con `%w`, sin estado global, `log/slog`, graceful shutdown) y agregar `domain/`, `application/`, `infrastructure/` e `interfaces/http/` bajo `internal/`.

## Qué usar al trabajar aquí

- **Skills:** `/adr` (registrar el stack), `/scaffold-servicio audit`, `/nuevo-endpoint`, `/revisar`, `/crear-pr`.
- **Agente revisor:** `guardian-contratos` (consume todos los contratos) y `revisor-seguridad` (datos personales y acceso `ADMIN`).
