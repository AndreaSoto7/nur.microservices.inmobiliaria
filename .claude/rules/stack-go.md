---
paths:
  - "services/search-service/**"
  - "services/notification-service/**"
---

# search-service y notification-service — Go

Son dos servicios independientes, cada uno con su propio `go.mod`, su propia base de datos y su propio consumer group. No comparten paquetes entre sí.

El gateway también está en Go, pero tiene su propia rule (`stack-gateway`), porque no tiene dominio ni base de datos.

## Estructura

```
services/<servicio>/
  cmd/<servicio>/main.go        # wiring: config, DB, Kafka, HTTP; graceful shutdown
  internal/
    domain/                     # entidades, value objects, errores, interfaces de repositorio
    application/                # casos de uso (commands/queries), puertos
    infrastructure/
      postgres/                 # repositorios (pgx)
      kafka/                    # consumers (+ DLQ), mappers de eventos de integración
      consul/                   # registro y baja en Consul (rule service-discovery)
    interfaces/http/            # handlers, DTOs, middleware (JWT, correlation-id, problem+json), /health y /health/ready
  go.mod  go.sum  .env.example  Dockerfile
```

Módulo: `github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/<servicio>`.

## Convenciones de Go

- **Interfaces chicas, declaradas donde se consumen** (el paquete `application` define `PropertyProjectionRepository`; `postgres` lo implementa).
- **`context.Context`** es el primer parámetro de toda operación de I/O y se propaga.
- **Errores:** se envuelven con `fmt.Errorf("...: %w", err)` y se comparan con `errors.Is` / `errors.As`. Nada de `panic` en flujo normal.
- **Sin estado global:** las dependencias se crean en `main` y se inyectan por constructor (`NewSearchHandler(repo)`).
- **Librerías:**
  - HTTP: `net/http` de la librería estándar, con patrones de ruta por método (`mux.HandleFunc("GET /api/v1/search/properties", ...)`).
  - Logs: `log/slog` en JSON.
  - Base de datos: `pgx`.
  - Kafka: `github.com/segmentio/kafka-go` (Go puro, sin CGO, funciona igual en Windows).
- **Graceful shutdown** con `signal.NotifyContext`: se da de baja en Consul y después cierra el HTTP server y los consumers.

## Registro en Consul

Sigue el contrato de la rule `service-discovery`.

- En `main`, primero se abre el listener (`net.Listen`) y se sirve en una goroutine. Recién después se registra, para que el primer health check encuentre el servidor arriba.
- La IP del contenedor se obtiene con `os.Hostname()` + `net.LookupHost`, salvo que `SERVICE_ADDRESS` venga lleno.
- El registro y la baja son un `PUT` con `net/http` y `encoding/json`. No hace falta el SDK de Consul.

## search-service (modelo de lectura, CQRS)

- Consume `listing.property.events`. Hace upsert de la proyección por `propertyId` e ignora los eventos más viejos que el último aplicado.
- En el catálogo solo aparecen las propiedades `PUBLISHED`. Las `RESERVED` se muestran marcadas como tales; las `PAUSED`, `SOLD` y `RENTED` se ocultan.
- `GET /api/v1/search/properties` (filtros, paginación y orden según la rule `api-rest`) y `GET /api/v1/search/properties/{id}`.
- Criterios de búsqueda con **Builder / functional options** y filtros combinables (**Specification**), con índices en la base para zona, tipo, precio y dormitorios.

## notification-service

- Consume eventos de identity, listing y visit, y crea notificaciones para el agente o el cliente.
- Canales con **Strategy** (`Channel` → `InAppChannel`, `EmailChannel` simulado, `LogChannel`).
- `GET /api/v1/notifications` (las del usuario del JWT) y `PATCH /api/v1/notifications/{id}` (`{ "read": true }`).

## Comandos

```bash
go run ./cmd/<servicio>
go test ./...
go vet ./...
gofmt -l .            # debe devolver vacío
golangci-lint run
```
