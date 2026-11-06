# Progreso — gateway

- **Responsable:** @Tiesol
- **Stack:** Go (propio)
- **Instrucciones:** [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| docs | Contrato de identity: errores 400, 401 y 404 `GATEWAY_*` que responde el gateway | #34 |
| chore | Scaffold: config validada, errores problem+json, `GET /health`, apagado limpio, Dockerfile y lint. Go 1.27 y Alpine 3.22, a registrar en el ADR de versiones | #35 |
| feat | Cadena de middlewares: recover, correlation-id, logs JSON y borrado de `X-User-*` | #51 |
| feat | Rate limit de login y registro: token bucket por IP y ruta, 429 con `Retry-After` y expiración de entradas | #52 |
| feat | CORS: orígenes por variable de entorno con comparación exacta, preflight antes de la auth y `Vary: Origin` | #53 |
| feat | Discovery: consulta periódica de réplicas sanas en Consul, con snapshot en memoria que sobrevive a fallas de Consul | #54 |
| feat | Balanceador: round robin (Strategy) y Circuit Breaker por réplica | #55 |
| feat | Tabla de rutas por prefijo, públicas y protegidas, y validación de paths (400 y 404) | #57 |
| feat | Paquete `auth`: validación del access token con el JWKS de identity (RS256, `iss`, `aud`, `exp` y `typ=at+jwt`), con caché y recarga limitada | #58 |
| feat | Eslabón de auth en la cadena: 401 con `WWW-Authenticate`, 503 si no hay JWKS, y discovery y balanceador cableados en `main` | #59 |
| feat | Núcleo del reverse proxy: reenvío a la réplica elegida, timeouts, errores 502, 503 y 504, y marcado de réplicas solo ante errores de red | #61 |
| feat | Límite de body por ruta (413), deadline de lectura en auth y body ilegible (400), sin marcar la réplica. `MAX_BODY_BYTES` sube a 26 MiB, lo que acepta listing | #62 |
| feat | Proxy cableado en `main`: el gateway ya reenvía a las réplicas sanas, con la cadena completa | #63 |
| feat | Gateway en el compose, probado de punta a punta con identity y listing reales: 3 réplicas repartidas en orden, y al matar una falla 1 request de 15 | #69 |
| feat | Ruta `/api/v1/notifications/**` hacia `notification-service`, con JWT. Responde 503 hasta que el servicio exista | este PR |

## Pendientes

**Base**

- [x] Scaffold con `/scaffold-servicio gateway` (esqueleto mínimo, sin dominio)

**Funcionalidad (ADR 0002)**

- [x] Reverse proxy y ruteo por prefijo hacia los nombres de servicio en Consul (tabla de rutas de `gateway/CLAUDE.md`, con `/api/v1/catalog/**` público y `/api/v1/audit/**`; ADR 0005)
- [x] Discovery: consulta periódica de las réplicas sanas en Consul
- [x] Balanceador round robin (Strategy) con marcado de réplicas caídas (Circuit Breaker)
- [x] Validar el JWT con el JWKS de identity (`typ=at+jwt`, `aud=inmobiliaria`) y borrar los `X-User-*`
- [x] CORS para el frontend (`http://localhost:5173`)
- [x] Rate limit de login y registro (**requisito antes de exponer identity**)
- [x] Comprobar en Docker qué IP ve el gateway desde la misma máquina: los clientes llegan como el gateway de la red de Docker (`172.x.0.1`) y comparten el límite; los contenedores llegan con su IP
- [ ] Comprobar el rate limit desde otra máquina, y en Docker Desktop (Windows): si todos llegan con la misma IP, una sola persona agota el límite y bloquea el login de los demás
- [x] Evaluar un tope de entradas en el rate limit: no hace falta. Medido: 1 millón de IP distintas ocupan unos 190 MB y la limpieza tarda 245 ms, y las entradas expiran en 2 minutos como máximo
- [x] Correlation-id, logs JSON, timeouts y errores problem+json propios
- [ ] Baja prioridad: refrescar el JWKS cada cierto tiempo. Hoy una clave retirada sigue valiendo en el gateway hasta que llegue un `kid` desconocido. Importa solo si identity empieza a rotar claves; hoy tiene una sola
- [x] Demo: `listing-service` escalado a 3 réplicas
