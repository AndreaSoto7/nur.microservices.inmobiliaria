---
paths:
  - "gateway/**"
---

# gateway — Go (gateway propio, balanceador y cliente de service discovery)

Decisión y alternativas: `docs/adr/0002-gateway-go-balanceador-consul.md`.

El gateway es el **único punto de entrada** del cliente (puerto 8080). Se encarga de:
- Ruteo por prefijo.
- Validación temprana del JWT.
- CORS.
- Rate limit.
- `X-Correlation-Id`.
- Balanceo de carga entre réplicas.
- Descubrir las réplicas sanas en Consul.

**No tiene lógica de negocio, ni base de datos, ni Kafka.** Por eso no lleva las capas `domain/` ni `application/` de la rule `ddd-clean-architecture`. Si una regla de negocio aparece en el gateway, va en el servicio dueño.

## Estructura

```
gateway/
  cmd/gateway/main.go       # wiring: config, discovery, balancer, cadena de middlewares, servidor HTTP; graceful shutdown
  internal/
    config/                 # variables de entorno y tabla de rutas (prefijo → nombre del servicio en Consul, pública o protegida)
    discovery/              # cliente de Consul: consulta periódica de réplicas sanas por servicio
    balancer/               # Strategy de balanceo (round robin) y marcado de réplicas caídas (Circuit Breaker)
    proxy/                  # reverse proxy: elige réplica con el balancer, timeouts, mapeo de errores del destino
    middleware/             # recover, correlation-id, logging, CORS, borrado de X-User-*, rate limit, auth
    auth/                   # validación JWT RS256 con el JWKS de identity (con caché)
    problem/                # respuestas application/problem+json del propio gateway
  go.mod  go.sum  .env.example  Dockerfile  README.md
```

Módulo: `github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway`. Las convenciones de Go (`context.Context`, errores con `%w`, sin estado global, `log/slog` en JSON, graceful shutdown) son las mismas de la rule `stack-go`.

## Ruteo

- La tabla de rutas es la de la rule `api-rest` ("Mapa de rutas del gateway"). El destino es un **nombre de servicio de Consul** (`listing-service`), nunca una dirección fija.
- El path se reenvía **sin reescribirlo**: el servicio recibe `/api/v1/...` igual que el cliente.
- **Rutas públicas** (sin JWT):
  - `GET /api/v1/search/**`
  - Registro, login y refresh de `/api/v1/auth/**`
  - El JWKS (`/api/v1/auth/.well-known/jwks.json`)
  - `GET /health`
- El resto exige `Authorization: Bearer`.
- Prefijo desconocido → 404 problem+json.

## Cadena de middlewares (Chain of Responsibility)

Cada middleware recibe un `http.Handler` y devuelve otro (`func(http.Handler) http.Handler`). Cada eslabón puede cortar la cadena (401, 429) o pasar al siguiente. El orden importa:

1. **Recover:** un `panic` se convierte en 500 problem+json y no tumba el proceso.
2. **Correlation-id:** si no llega `X-Correlation-Id`, se genera un UUID. Se reenvía al servicio y se devuelve en la respuesta.
3. **Logging:** método, ruta, status, duración, correlationId y réplica destino. Nunca el header `Authorization` ni el body.
4. **CORS:** origen permitido por variable de entorno (`http://localhost:5173`). Responde el preflight `OPTIONS` antes de la auth. Nunca `*` con credenciales.
5. **Borrado de headers de identidad:** borra cualquier `X-User-*` que llegue del cliente.
6. **Rate limit:** token bucket por IP en login y registro (`golang.org/x/time/rate`). La IP sale de `r.RemoteAddr`, no de un `X-Forwarded-For` enviado por el cliente.
7. **Auth:** en las rutas protegidas valida firma RS256, `exp`, `iss` y `aud`.
   - Fija el algoritmo esperado: rechaza `none` y `HS256`.
   - Si el token es válido, **reenvía `Authorization` intacto**: cada servicio vuelve a validar.
8. **Proxy.**

## Proxy (patrón Proxy)

- Se usa `httputil.ReverseProxy` con la función `Rewrite` (no `Director`). Allí se elige la réplica y se llama a `SetXForwarded()`.
- **Timeouts:**
  - Del servidor: `ReadHeaderTimeout` (evita Slowloris), `ReadTimeout`, `WriteTimeout` e `IdleTimeout`.
  - Hacia el destino: un `http.Transport` con `ResponseHeaderTimeout`.
- **Límite de body** con `http.MaxBytesReader`, compatible con las subidas de imágenes (5 MB por imagen según la rule `seguridad`). El body se reenvía en streaming: no se carga entero en memoria.
- `ErrorHandler`:
  - **Error de conexión o timeout del destino:** avisa al balancer para marcar la réplica como caída y responde 502 o 504 problem+json.
  - **5xx de negocio del servicio:** se devuelve tal cual. No marca la réplica.
- **Sin reintentos automáticos** de `POST`, `PUT`, `PATCH` ni `DELETE` en otra réplica: podrían duplicar efectos. Si se agregan reintentos, solo para `GET` y `HEAD`.

## Balanceador (`internal/balancer/`)

- **Strategy:** una interfaz chica para "elegir la próxima réplica de este servicio", con una implementación `RoundRobin`. Otro algoritmo (por ejemplo, menos conexiones) es otra implementación y no toca el proxy.
- **Round robin:** un contador por servicio, seguro ante concurrencia (`sync/atomic`), sobre la lista de réplicas sanas que entrega `discovery`.
- **Circuit Breaker por réplica:**
  - Una réplica que falla queda marcada como caída durante un tiempo configurable (por ejemplo, 30 s) y se salta, aunque Consul todavía la reporte sana.
  - Pasado ese tiempo vuelve a probarse (medio abierto).
  - Es un respaldo: la fuente de verdad sigue siendo el health check de Consul.
- Si no queda ninguna réplica disponible → 503 problem+json.

## Discovery (`internal/discovery/`)

- **Consulta:** cada pocos segundos (variable de entorno) se pide `GET {CONSUL_HTTP_ADDR}/v1/health/service/<nombre>?passing=true` para cada servicio de la tabla de rutas. Basta con `net/http` y `encoding/json`; no hace falta el SDK de Consul.
- **Réplicas:** de cada entrada se usan `Service.Address` y `Service.Port`.
- **Snapshot:** se guarda en memoria y se lee de forma concurrente (`sync.RWMutex` o `atomic.Pointer`).
- **Si Consul no responde:** se conserva el último snapshot, se loguea un warning y se reintenta en el siguiente ciclo.
- **El gateway no se registra en Consul.** Nadie necesita descubrirlo.
- El JWKS de identity también se resuelve por discovery (`identity-service`). Se cachea y se refresca cuando llega un `kid` desconocido.

## Errores propios del gateway

Todos en `application/problem+json`, con `code` estable y `correlationId`:

| Status | `code` | Cuándo |
|---|---|---|
| 401 | `GATEWAY_UNAUTHORIZED` | Falta el token o es inválido en una ruta protegida |
| 404 | `GATEWAY_ROUTE_NOT_FOUND` | Ningún prefijo coincide |
| 413 | `GATEWAY_PAYLOAD_TOO_LARGE` | El body supera el límite |
| 429 | `GATEWAY_RATE_LIMITED` | Rate limit |
| 502 | `GATEWAY_UPSTREAM_ERROR` | Error de conexión con la réplica |
| 503 | `GATEWAY_NO_HEALTHY_INSTANCE` | No hay réplicas disponibles del servicio |
| 504 | `GATEWAY_UPSTREAM_TIMEOUT` | La réplica no respondió a tiempo |

## Configuración (`.env.example`)

| Variable | Ejemplo |
|---|---|
| `GATEWAY_PORT` | `8080` |
| `CONSUL_HTTP_ADDR` | `http://consul:8500` |
| `DISCOVERY_REFRESH_INTERVAL` | `5s` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `identity-service` / `inmobiliaria` |
| `RATE_LIMIT_AUTH_PER_MINUTE` | `10` |
| `UPSTREAM_TIMEOUT` | `10s` |
| `REPLICA_DOWN_DURATION` | `30s` |
| `MAX_BODY_BYTES` | `10485760` |

## Tests

Con `go test ./...`, table-driven y con `net/http/httptest`. **Sin Consul ni servicios reales:** `discovery` se reemplaza por un fake que implementa la misma interfaz.

- **Ruteo:** el prefijo correcto llega al servicio correcto; un prefijo desconocido da 404.
- **Round robin:** con 3 servidores falsos, las requests se reparten en orden.
- **Circuit Breaker:** una réplica que corta la conexión queda fuera y vuelve después del tiempo configurado.
- **Auth:** genera un par RSA en el test y sirve un JWKS falso. Sin token → 401, token vencido → 401, token válido → llega con `Authorization` intacto.
- **Headers:** un `X-User-Id` del cliente no llega al servicio.
- **CORS y rate limit:** el preflight responde los headers correctos; la request N+1 al login da 429.

## Comandos

```bash
go run ./cmd/gateway
go test ./...
go vet ./...
gofmt -l .            # debe devolver vacío
golangci-lint run
```
