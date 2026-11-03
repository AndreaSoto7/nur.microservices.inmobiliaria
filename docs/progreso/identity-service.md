# Progreso — identity-service

- **Responsable:** @Tiesol
- **Stack:** Django 5.2 LTS + DRF, Python 3.13
- **Rules:** `stack-django`, `ddd-clean-architecture`, `service-discovery`, `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Registro de usuario, API: repositorio Django, hasher, `POST /api/v1/auth/register` y errores problem+json | este PR |
| feat | Registro de usuario, dominio: agregado `User` inmutable y `RegisterUserCommand` (entró a `main` junto con el #7) | #8 |
| chore | Scaffold: capas, health, registro en Consul, problem+json, correlation-id y Dockerfile | #7 |
| feat | Contrato OpenAPI de identity (registro, login y JWKS) | #6 |

## Pendientes

- [ ] Login con JWT RS256 (`kid`) y JWKS
- [ ] Refresh token (`POST /api/v1/auth/refresh`) con rotación y revocación
- [ ] `GET /api/v1/users/me`
- [ ] Publicar `UserRegistered` con outbox y relay a Kafka. Necesita `infra/` con Kafka, el schema del evento en `contracts/events/` y definir la unidad de trabajo (usuario + outbox en la misma transacción)

**Depende de otros**

- Rate limit de registro y login en el gateway ([gateway.md](gateway.md)). **No exponer identity sin él.**
