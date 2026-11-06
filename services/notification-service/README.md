# notification-service

Avisos dentro de la app para agentes y clientes, creados a partir de eventos de Kafka. La decisión está en el [ADR 0007](../../docs/adr/0007-retomar-notification-service.md) y el diseño completo en [`CLAUDE.md`](CLAUDE.md).

## Correrlo

```bash
docker compose -f infra/docker-compose.yml up -d --build notification-service
```

Fuera de Docker (requiere Go 1.27, PostgreSQL y Kafka):

```bash
go run ./cmd/notification-service
go test ./...
go vet ./...
gofmt -l .                 # debe devolver vacío
golangci-lint run
```

## Variables

Están en [`.env.example`](.env.example). `DATABASE_URL` y `KAFKA_BOOTSTRAP_SERVERS` son obligatorias; el resto tiene valor por defecto.

## API

Contrato: [`contracts/openapi/notification-service.yaml`](../../contracts/openapi/notification-service.yaml). Puerto 8005, por el gateway en `/api/v1/notifications`.
