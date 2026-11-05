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

## Pendientes

**Base**

- [x] Scaffold con `/scaffold-servicio gateway` (esqueleto mínimo, sin dominio)

**Funcionalidad (ADR 0002)**

- [ ] Reverse proxy y ruteo por prefijo hacia los nombres de servicio en Consul (tabla de rutas de `gateway/CLAUDE.md`, con `/api/v1/catalog/**` público y `/api/v1/audit/**`; ADR 0005)
- [x] Discovery: consulta periódica de las réplicas sanas en Consul
- [x] Balanceador round robin (Strategy) con marcado de réplicas caídas (Circuit Breaker)
- [ ] Validar el JWT con el JWKS de identity (`typ=at+jwt`, `aud=inmobiliaria`) y borrar los `X-User-*`
- [x] CORS para el frontend (`http://localhost:5173`)
- [x] Rate limit de login y registro (**requisito antes de exponer identity**)
- [ ] Comprobar en Docker qué IP ve el gateway: si todos llegan con la misma, el límite pasa a ser global
- [ ] Evaluar un tope de entradas en el rate limit (hoy expiran a los 60 s y cada una exige una IP o un /64 distinto)
- [ ] Correlation-id, logs JSON, timeouts y errores problem+json propios
- [ ] Demo: `listing-service` escalado a 3 réplicas
