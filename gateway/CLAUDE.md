# gateway — Go (gateway propio, balanceador y cliente de service discovery)

Instrucciones para trabajar en el gateway. Complementa al `CLAUDE.md` raíz, que siempre aplica. Si algo de aquí no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | @Tiesol |
| Stack | Go 1.27, librería estándar, `google/uuid` (correlation-id), `golang.org/x/time/rate` (rate limit), `golang-jwt/jwt/v5` y `golang.org/x/sync/singleflight` (auth) |
| Puerto | 8080 (el único publicado en el host junto con el frontend) |
| Base / Kafka | Ninguno |
| Decisión | [ADR 0002](../docs/adr/0002-gateway-go-balanceador-consul.md) |
| Progreso | [`docs/progreso/gateway.md`](../docs/progreso/gateway.md) |
| Guía para personas | [`README.md`](README.md) |

## Qué hace y qué no

Único punto de entrada del cliente: ruteo por prefijo, validación temprana del JWT, CORS, rate limit, `X-Correlation-Id`, balanceo de carga entre réplicas y descubrimiento de réplicas sanas en Consul.

**No tiene lógica de negocio, ni base de datos, ni Kafka, ni OpenAPI propio, y no se registra en Consul.** Por eso no lleva las capas `domain/` ni `application/`. Si aparece una regla de negocio aquí, va en el servicio dueño.

## Estructura

```
gateway/
  cmd/gateway/main.go       wiring: config, discovery, balancer, cadena de middlewares, servidor HTTP; graceful shutdown
  internal/
    config/                 variables de entorno y tabla de rutas (prefijo → servicio en Consul, pública o protegida)
    discovery/              cliente de Consul: consulta periódica de réplicas sanas
    balancer/               Strategy de balanceo (round robin) y Circuit Breaker por réplica
    proxy/                  reverse proxy: elige réplica, timeouts, mapeo de errores del destino
    middleware/             recover, correlation-id, logging, CORS, borrado de X-User-*, rate limit, auth
    auth/                   validación JWT RS256 con el JWKS de identity (con caché)
    problem/                respuestas application/problem+json propias
  go.mod  go.sum  .env.example  Dockerfile  README.md
```

Módulo: `github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway`.

## Convenciones de Go

- **Interfaces chicas, declaradas donde se consumen** (el `balancer` define lo que necesita de `discovery`).
- **`context.Context`** es el primer parámetro de toda operación de I/O y se propaga.
- **Errores:** `fmt.Errorf("...: %w", err)`, comparados con `errors.Is` / `errors.As`. Nada de `panic` en flujo normal.
- **Sin estado global:** las dependencias se crean en `main` y se inyectan por constructor.
- **Librerías:** `net/http` con patrones de ruta por método; logs con `log/slog` en JSON.
- **Graceful shutdown** con `signal.NotifyContext`.

## Rutas

| Prefijo | Servicio en Consul | Acceso |
|---|---|---|
| `/api/v1/auth/**`, `/api/v1/users/**` | `identity-service` | auth: pública (ver abajo); users: JWT |
| `/api/v1/properties/**`, `/api/v1/favorites/**` | `listing-service` | JWT, salvo las imágenes |
| `/api/v1/catalog/**` | `listing-service` | Pública (`GET`) |
| `/api/v1/inquiries/**`, `/api/v1/visits/**`, `/api/v1/leads/**` | `visit-service` | JWT |
| `/api/v1/audit/**` | `audit-service` (opcional) | JWT (`ADMIN` lo valida el servicio) |
| `/api/v1/notifications/**` | `notification-service` | JWT |

- El destino es un **nombre de servicio de Consul**, nunca una dirección fija. El path se reenvía **sin reescribirlo**.
- **Rutas públicas** (sin JWT). Las de auth se comparan **de forma exacta**, por método y path. Los paths con segmentos `..` o vacíos (`//`) se rechazan con 400, evaluando por segmentos sobre `r.URL.Path` ya decodificado (así `%2e%2e` tampoco pasa).
  - `GET /api/v1/catalog/**`
  - `GET /api/v1/properties/{propertyId}/images/{imageId}`
  - `POST /api/v1/auth/register`, `/login`, `/refresh` y `/logout` (refresh y logout usan el refresh token del body: deben funcionar aunque el access token venció)
  - `GET /api/v1/auth/.well-known/jwks.json`
  - `GET /health`
- El resto exige `Authorization: Bearer`. Prefijo desconocido → 404 problem+json.

## Cadena de middlewares (Chain of Responsibility)

Cada middleware es `func(http.Handler) http.Handler` y puede cortar la cadena. El orden importa:

1. **Recover:** un `panic` → 500 problem+json, sin tumbar el proceso.
2. **Correlation-id:** si falta `X-Correlation-Id` o no cumple `^[A-Za-z0-9._-]{1,128}$`, se genera un UUID. Se reenvía y se devuelve.
3. **Logging:** método, ruta, status, duración, correlationId y réplica. Nunca `Authorization` ni el body.
4. **CORS:** orígenes por variable de entorno, comparación exacta y `Vary: Origin`. Responde el preflight `OPTIONS` antes de la auth. Nunca `*`.
5. **Borrado de `X-User-*`** que lleguen del cliente.
6. **Ruteo:** valida el path (400) y resuelve la ruta (404). Va antes del rate limit y de la auth, para que todos decidan con el mismo path. También rechaza `;`, `\`, `%` restante (doble codificación) y caracteres de control.
7. **Rate limit:** token bucket por IP y ruta en login y registro (`golang.org/x/time/rate`).
   - IP desde `r.RemoteAddr` con `net.SplitHostPort` (sin puerto), nunca de un `X-Forwarded-For` del cliente.
   - Las entradas viejas expiran. Comprobado en Docker: los clientes de la misma máquina y los de otra red de Docker pasan por `docker-proxy`, llegan como el gateway de la red (`172.x.0.1`) y comparten el límite. Los contenedores de la misma red llegan con su IP. Sin verificar desde otra máquina. Si hace falta, el límite se sube con `RATE_LIMIT_AUTH_PER_MINUTE`. No loguear la IP de forma permanente.
8. **Auth** en rutas protegidas: `jwt.WithValidMethods(["RS256"])`, `WithExpirationRequired()`, `WithIssuer`, `WithAudience`; exige `typ=at+jwt` (un refresh token con `typ=rt+jwt` nunca pasa). Si es válido, **reenvía `Authorization` intacto**.
9. **Proxy.**

## Proxy (patrón Proxy)

- `httputil.ReverseProxy` con `Rewrite` (no `Director`), que llama a `SetURL()` y `SetXForwarded()`.
- **La réplica se elige antes de `ServeHTTP`** y viaja en el contexto: así el 503 por falta de réplicas se resuelve antes.
- **Timeouts:** del servidor (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`) y hacia el destino (`ResponseHeaderTimeout` en el `http.Transport`).
- **Límite de body** con `http.MaxBytesReader`: 64 KB en `/api/v1/auth/**`, 1 MB por defecto y `MAX_BODY_BYTES` solo en las subidas de imágenes. El body va en streaming.
- **Lecturas lentas:** en `/api/v1/auth/**` con body, deadline de `AUTH_READ_TIMEOUT` con `http.ResponseController.SetReadDeadline`. `net/http` lo quita solo al llegar al final del body. Sin body no se pone: nadie lo quitaría, y al vencer cancelaría la request aunque solo identity esté tardando.
- `ErrorHandler`: **solo se marca la réplica si la culpa es del destino.**
  - Cliente canceló → no marca. `*http.MaxBytesError` → 413, no marca. Body del cliente ilegible → 400, no marca.
  - Error de red (dial, reset, timeout) → marca la réplica y responde 502 o 504. Cualquier otro error responde 502 sin marcar: marcar de más deja a un cliente sacar réplicas sanas.
  - `detail` fijo; `err.Error()` solo al log. Los 5xx de negocio del servicio se devuelven tal cual.
- **Al reenviar:** se borra `Upgrade` antes de `ReverseProxy` (un túnel `h2c` esquivaría al gateway, y un valor inválido daría un error que parece de transporte) y se quita `X-Forwarded-Host` (es el Host del cliente, y ningún servicio lo usa).
- **En la respuesta:** se quitan `X-Correlation-Id` y `Access-Control-*` (son del gateway y quedarían duplicados), `Server` y `X-Powered-By`. Un `Location` absoluto hacia la réplica se vuelve relativo.
- **Sin reintentos** de `POST`, `PUT`, `PATCH` ni `DELETE` en otra réplica. Si se agregan, solo para `GET` y `HEAD`.

## Balanceador y discovery

- **Strategy:** una interfaz "elegir la próxima réplica" con la implementación `RoundRobin` (contador por servicio con `sync/atomic`).
- **Circuit Breaker por réplica:** una réplica que falla queda fuera `REPLICA_DOWN_DURATION` y luego se vuelve a probar. Es un respaldo de los health checks de Consul. Sin réplicas → 503.
- **Discovery:** cada `DISCOVERY_REFRESH_INTERVAL`, `GET {CONSUL_HTTP_ADDR}/v1/health/service/<nombre>?passing=true` por cada servicio de la tabla (sin SDK). Snapshot en memoria con `sync.RWMutex` o `atomic.Pointer`. Si Consul no responde, se conserva el último y se loguea un warning.
- **JWKS** de identity también por discovery, cacheado. Ante un `kid` desconocido se recarga **como máximo una vez cada 30 s y con una sola recarga en curso** (`singleflight`); si sigue sin aparecer, 401. Además se renueva cada 5 minutos, para que una clave retirada deje de valer; si esa descarga falla, conserva las claves conocidas. Si no se pudo descargar el JWKS no se sabe si el token es válido, así que responde 503; mientras no haya ninguna clave, el freno baja a 5 s, porque el gateway suele arrancar antes que identity.

## Errores propios

Todos en `application/problem+json`, con `code` estable y `correlationId` (`internal/problem/`):

| Status | `code` | Cuándo |
|---|---|---|
| 401 | `GATEWAY_UNAUTHORIZED` | Falta el token o es inválido en una ruta protegida |
| 404 | `GATEWAY_ROUTE_NOT_FOUND` | Ningún prefijo coincide |
| 400 | `GATEWAY_BAD_REQUEST` | Path con `..` o `//`, o body ilegible |
| 413 | `GATEWAY_PAYLOAD_TOO_LARGE` | El body supera el límite |
| 429 | `GATEWAY_RATE_LIMITED` | Rate limit |
| 502 | `GATEWAY_UPSTREAM_ERROR` | Error de conexión con la réplica |
| 503 | `GATEWAY_NO_HEALTHY_INSTANCE` | No hay réplicas disponibles, o no se pudo descargar el JWKS |
| 504 | `GATEWAY_UPSTREAM_TIMEOUT` | La réplica no respondió a tiempo |

## Configuración

Variables, valores por defecto y validación: [`README.md`](README.md#variables) y `.env.example`. Un valor inválido impide arrancar.

## Tests

`go test ./...`, table-driven, con `net/http/httptest`. **Sin Consul ni servicios reales:** `discovery` se reemplaza por un fake.

- Ruteo correcto y 404; round robin con 3 servidores falsos; Circuit Breaker (una réplica que corta queda fuera y vuelve).
- Auth con un par RSA generado en el test y un JWKS falso: sin token, vencido, sin `exp`, `alg=none`, HS256 con la clave pública, `iss`/`aud` incorrectos, `typ=rt+jwt` y `kid` desconocido → 401; válido → `Authorization` intacto.
- Cliente que cancela, body grande o chunked malformado no marcan la réplica; muchos `kid` al azar → una sola recarga del JWKS.
- `..`, `%2e%2e` y `//` → 400; un `X-User-Id` del cliente no llega al servicio; preflight CORS; la request N+1 al login → 429.

## Comandos

```bash
go run ./cmd/gateway
go test ./...
go vet ./...
gofmt -l .            # debe devolver vacío
golangci-lint run
```

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `api-rest` (mapa de rutas), `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`. **No** aplica `ddd-clean-architecture`.
- **Skills:** `/caso-de-uso` no aplica (no hay dominio). Usa `/aplicar-patron` (Proxy, Chain of Responsibility, Strategy, Circuit Breaker), `/revisar` y `/crear-pr`.
- **Agente revisor:** `revisor-seguridad`.
