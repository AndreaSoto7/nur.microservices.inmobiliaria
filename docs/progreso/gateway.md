# Progreso — gateway

- **Responsable:** @Tiesol
- **Stack:** Go (propio)
- **Instrucciones:** [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| docs | Contrato de identity: errores 400, 401 y 404 `GATEWAY_*` que responde el gateway | #34 |
| chore | Scaffold: config validada, errores problem+json, `GET /health`, apagado limpio, Dockerfile y lint. Go 1.27 y Alpine 3.22, a registrar en el ADR de versiones | #35 |
| feat | Cadena de middlewares: recover, correlation-id, logs JSON y borrado de `X-User-*` | este PR |

## Pendientes

**Base**

- [x] Scaffold con `/scaffold-servicio gateway` (esqueleto mínimo, sin dominio)

**Funcionalidad (ADR 0002)**

- [ ] Reverse proxy y ruteo por prefijo hacia los nombres de servicio en Consul (tabla de rutas de `gateway/CLAUDE.md`, con `/api/v1/catalog/**` público y `/api/v1/audit/**`; ADR 0005)
- [ ] Discovery: consulta periódica de las réplicas sanas en Consul
- [ ] Balanceador round robin (Strategy) con marcado de réplicas caídas (Circuit Breaker)
- [ ] Validar el JWT con el JWKS de identity (`typ=at+jwt`, `aud=inmobiliaria`) y borrar los `X-User-*`
- [ ] CORS para el frontend (`http://localhost:5173`)
- [ ] Rate limit de login y registro (**requisito antes de exponer identity**)
- [ ] Correlation-id, logs JSON, timeouts y errores problem+json propios
- [ ] Demo: `listing-service` escalado a 3 réplicas
