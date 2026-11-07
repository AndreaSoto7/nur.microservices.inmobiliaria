# notification-service — Go

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica. Decisión: [ADR 0007](../../docs/adr/0007-retomar-notification-service.md).

## Ficha

| | |
|---|---|
| Responsable | @Tiesol |
| Stack | Go 1.27, `net/http`, `log/slog`, `pgx`, `segmentio/kafka-go`, `golang-jwt/jwt/v5` |
| Puerto | 8005 |
| Base | `notification` (PostgreSQL 17) → [`docs/base-de-datos/notification-service.md`](../../docs/base-de-datos/notification-service.md) |
| API | [`contracts/openapi/notification-service.yaml`](../../contracts/openapi/notification-service.yaml) |
| Ruta del gateway | `/api/v1/notifications/**` (JWT) |
| Publica | Nada |
| Consume | `identity.user.events`, `listing.property.events`, `visit.visit.events` |
| Progreso | [`docs/progreso/notification-service.md`](../../docs/progreso/notification-service.md) |

## Qué hace y qué no

- **Hace:** convierte eventos de otros servicios en avisos dentro de la app. Cada usuario ve solo los suyos y los marca como leídos.
- **No hace:** enviar emails, guardar datos personales, publicar eventos ni llamar a otro servicio por HTTP (salvo el JWKS de identity y Consul, autorizados por el ADR 0002).

## Dominio

**Aggregate `Notification`:** `id`, `recipientId` (el `sub` del JWT), `type`, `message`, `propertyId` y `visitId` opcionales, `createdAt` y `readAt`.

- `NewNotification` valida y genera el UUID. Sin destinatario o con un tipo desconocido, no se crea.
- `NewNotification` deja los UUID en su forma canónica: el destinatario se compara con el `sub` del JWT.
- `MarkReadBy` es idempotente: marcar dos veces conserva la primera fecha.
- `MarkReadBy` lo pide solo su destinatario. A cualquier otro le responde `ErrNotificationNotFound` (404): no se revela que existe.

**Tipos (`NotificationType`):** `WELCOME`, `VISIT_REQUESTED`, `PROPERTY_RESERVED`, `INQUIRY_RECEIVED`, `VISIT_SCHEDULED`, `VISIT_REJECTED`, `VISIT_CANCELLED` y `VISIT_CANCELLED_BY_CLIENT`.

## Casos de uso

| Tipo | Caso de uso | Disparador |
|---|---|---|
| Política | `EventPolicies`, que decide a quién avisar y usa `NotifyOnEvent` | Un evento del catálogo (tabla de abajo) |
| Comando | `MarkNotificationRead` | `PATCH /api/v1/notifications/{notificationId}` |
| Consulta | `ListNotifications` | `GET /api/v1/notifications`, con `page`, `size` y `unread` |

## Eventos que consume

Consumer group `notification-service`, desde el principio de cada topic: `identity.user.events`, `listing.property.events`, `visit.inquiry.events` y `visit.visit.events`.

| Evento (`v1`) | Destinatario | Aviso |
|---|---|---|
| `UserRegistered` | `userId` | `WELCOME` |
| `VisitRequested` | `agentId` | `VISIT_REQUESTED` |
| `PropertyReserved` con `actor: SYSTEM` | `agentId` | `PROPERTY_RESERVED` |
| `InquiryReceived` | `agentId` | `INQUIRY_RECEIVED` |
| `VisitScheduled` | `clientId` | `VISIT_SCHEDULED` |
| `VisitRejected` | `clientId` | `VISIT_REJECTED` |
| `VisitCancelled` con `actor: AGENT` o `SYSTEM` | `clientId` | `VISIT_CANCELLED` |
| `VisitCancelled` con `actor: CLIENT` | `agentId` | `VISIT_CANCELLED_BY_CLIENT` |

- **Idempotente:** el aviso y el `eventId` en `processed_events` se guardan en la misma transacción.
- **Anti-corruption layer:** `infrastructure/kafka` traduce el evento a un comando propio. Del payload de `UserRegistered` solo lee `userId`, nunca el email ni el nombre. De una visita no lee el motivo: el texto del aviso es fijo.
- **Se ignoran,** sin fallar, los `eventType` y las versiones desconocidas.
- **Errores técnicos:** 3 reintentos con backoff, después `<topic>.dlq`, y sigue. Un mensaje ilegible, o con datos inválidos (`application.IsPermanent`), va directo a la DLQ.
- **DLQ:** copia el mensaje entero, con el motivo, el topic, la partición y el offset en los headers. Por eso `identity.user.events.dlq` también lleva email y nombre, con la misma retención por defecto que su topic. El motivo es fijo: el detalle del error va solo al log.
- **`VisitCancelled` avisa a la otra parte:** quien canceló ya lo sabe. Un `actor` desconocido no avisa a nadie.

## Estructura

```
services/notification-service/
  cmd/notification-service/main.go   wiring: config, base, Kafka, HTTP, Consul; graceful shutdown
  internal/
    domain/                          Notification, NotificationType, errores, NotificationRepository
    application/                     EventPolicies, NotifyOnEvent, MarkNotificationRead, ListNotifications
                                     y sus puertos: IdempotentNotificationStore, NotificationReader
    infrastructure/
      postgres/                      repositorio con pgx y migraciones embebidas
      kafka/                         consumidor, traductor de eventos y DLQ
      consul/                        registro, repetición cada 60 s y baja
      jwks/                          validación del access token con el JWKS de identity
      config/                        variables de entorno
    interfaces/http/                 handlers, DTOs, middleware (JWT, correlation-id, problem+json), health
  go.mod  go.sum  .env.example  Dockerfile  README.md
```

Módulo: `github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service`.

## Convenciones de Go

- **Dependencias hacia adentro:** `domain` no importa nada del proyecto ni frameworks. `application` solo importa `domain`.
- **Interfaces chicas, declaradas donde se consumen.**
- **`context.Context`** es el primer parámetro de toda operación de I/O.
- **Errores:** `fmt.Errorf("...: %w", err)`, comparados con `errors.Is` / `errors.As`.
- **Sin estado global:** las dependencias se crean en `main` y se inyectan por constructor. El reloj también.

## Base de datos

Migraciones SQL embebidas en `infrastructure/postgres/migrations/` (`NNNN_descripcion.sql`). Se aplican al arrancar, con un advisory lock: varias réplicas pueden arrancar a la vez. No se modifica una migración ya aplicada en `main`.

## Registro en Consul

Sigue la rule `service-discovery`, sin el SDK de Consul:

- Primero abre el listener y sirve; recién después se registra.
- La IP sale de `os.Hostname()` + `net.LookupHost`, salvo que venga `SERVICE_ADDRESS`.
- Una goroutine repite el registro cada 60 s. Al apagar, se detiene **antes** de la baja.
- Si Consul no está, el servicio arranca igual.
- **Orden de apagado:** baja en Consul, consumidor Kafka y servidor HTTP. Debe tardar menos que los 10 s de `docker stop`.

## Tests

- **Dominio y aplicación:** puros, con un repositorio en memoria.
- **HTTP:** `httptest`, con JWT firmado en el test y un JWKS falso.
- **Consumidor:** lector y DLQ falsos: duplicados, eventos desconocidos, reintentos y DLQ.
- **Consul:** servidor falso que verifica el body del `PUT`.
- **Repositorio:** contra PostgreSQL real, con `TEST_DATABASE_URL`. Sin esa variable, el test se salta.

## Comandos

```bash
go run ./cmd/notification-service
go test ./...
go vet ./...
gofmt -l .            # debe devolver vacío
golangci-lint run
```

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `ddd-clean-architecture`, `api-rest`, `eventos-kafka`, `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`.
- **Skills:** `/caso-de-uso`, `/nuevo-endpoint`, `/nuevo-evento`, `/revisar`, `/crear-pr`.
- **Agentes revisores:** `arquitecto-ddd` (dominio y capas), `guardian-contratos` (consumidores) y `revisor-seguridad` (JWT y acceso a avisos).
