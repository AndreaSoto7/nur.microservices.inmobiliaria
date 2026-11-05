# gateway

Único punto de entrada del cliente a la plataforma. Es propio, en Go. La decisión está en el [ADR 0002](../docs/adr/0002-gateway-go-balanceador-consul.md) y el diseño completo en [`CLAUDE.md`](CLAUDE.md).

No tiene lógica de negocio, base de datos ni Kafka, y no se registra en Consul.

## Correrlo

```bash
go run ./cmd/gateway       # puerto 8080 por defecto
go test ./...
go vet ./...
gofmt -l .                 # debe devolver vacío
golangci-lint run
```

Requiere Go 1.27.

## Variables

Todas tienen valor por defecto, y un valor inválido impide arrancar. Están en [`.env.example`](.env.example).

| Variable | Por defecto | Para qué |
|---|---|---|
| `GATEWAY_PORT` | `8080` | Puerto del gateway |
| `CONSUL_HTTP_ADDR` | `http://consul:8500` | API de Consul |
| `DISCOVERY_REFRESH_INTERVAL` | `5s` | Cada cuánto se consultan las réplicas sanas |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `identity-service` / `inmobiliaria` | Claims exigidos en el access token |
| `RATE_LIMIT_AUTH_PER_MINUTE` | `10` | Límite por IP y ruta en login y registro |
| `UPSTREAM_TIMEOUT` | `10s` | Espera máxima a que una réplica responda |
| `REPLICA_DOWN_DURATION` | `30s` | Tiempo fuera del balanceo tras un fallo |
| `MAX_BODY_BYTES` | `10485760` | Límite de body en las subidas de imágenes |
| `AUTH_READ_TIMEOUT` | `5s` | Tiempo máximo para recibir el body en `/api/v1/auth/**` |

## Rutas

| Prefijo | Servicio en Consul |
|---|---|
| `/api/v1/auth/**`, `/api/v1/users/**` | `identity-service` |
| `/api/v1/properties/**`, `/api/v1/favorites/**`, `/api/v1/catalog/**` | `listing-service` |
| `/api/v1/inquiries/**`, `/api/v1/visits/**`, `/api/v1/leads/**` | `visit-service` |
| `/api/v1/audit/**` | `audit-service` (opcional) |

El path se reenvía sin reescribirlo. `GET /health` lo responde el propio gateway. Rutas públicas y reglas de acceso: [`CLAUDE.md`](CLAUDE.md#rutas). El ruteo todavía no está implementado (ver `docs/progreso/gateway.md`).
