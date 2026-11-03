# Progreso por feature

Cada PR de feature actualiza su fila en el mismo PR. Para evitar conflictos, cada responsable edita solo la sección de su servicio.

**Estados:** ⬜ pendiente · 🟡 en PR · ✅ mergeado

## identity-service

| Feature | Estado | PR | Notas |
|---|---|---|---|
| Contrato OpenAPI (registro, login, JWKS) | 🟡 | #6 | |
| Scaffold (capas, health, Consul, problem+json) | 🟡 | #7 | |
| Registro de usuario (`POST /api/v1/auth/register`) | 🟡 | #8, #9 | Agregado `User`, `RegisterUserCommand`. `UserRegistered` queda registrado en el agregado; falta publicarlo. Pendiente: rate limit de registro y login en el gateway. |
| Login con JWT RS256 y JWKS | ⬜ | | `AuthenticateUserQuery`, `kid` en el header |
| Publicar `UserRegistered` (outbox + relay a Kafka) | ⬜ | | Necesita `infra/` con Kafka y el schema del evento en `contracts/events/`. Definir la unidad de trabajo (usuario + outbox en la misma transacción). |
| Refresh token | ⬜ | | Endpoint compatible en v1 |

## listing-service

| Feature | Estado | PR | Notas |
|---|---|---|---|

## visit-service

| Feature | Estado | PR | Notas |
|---|---|---|---|

## search-service

| Feature | Estado | PR | Notas |
|---|---|---|---|

## notification-service

| Feature | Estado | PR | Notas |
|---|---|---|---|

## gateway

| Feature | Estado | PR | Notas |
|---|---|---|---|

## frontend

| Feature | Estado | PR | Notas |
|---|---|---|---|

## Infraestructura

| Feature | Estado | PR | Notas |
|---|---|---|---|
| `infra/docker-compose.yml` (Kafka, Consul, bases) y override de depuración | ⬜ | | ADR 0002 |
