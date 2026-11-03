# Progreso — gateway

- **Responsable:** @Tiesol
- **Stack:** Go (propio)
- **Rules:** `stack-gateway`, `service-discovery`, `seguridad`, `api-rest`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Scaffold con `/scaffold-servicio gateway` (esqueleto mínimo, sin dominio)

**Funcionalidad (ADR 0002)**

- [ ] Reverse proxy y ruteo por prefijo hacia los nombres de servicio en Consul
- [ ] Discovery: consulta periódica de las réplicas sanas en Consul
- [ ] Balanceador round robin (Strategy) con marcado de réplicas caídas (Circuit Breaker)
- [ ] Validar el JWT con el JWKS de identity (`typ=at+jwt`, `aud=inmobiliaria`) y borrar los `X-User-*`
- [ ] CORS para el frontend (`http://localhost:5173`)
- [ ] Rate limit de login y registro (**requisito antes de exponer identity**)
- [ ] Correlation-id, logs JSON, timeouts y errores problem+json propios
- [ ] Demo: `listing-service` escalado a 3 réplicas
