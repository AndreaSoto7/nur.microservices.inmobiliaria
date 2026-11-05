# Progreso — identity-service

- **Responsable:** @Tiesol
- **Stack:** Django 5.2 LTS + DRF, Python 3.13
- **Instrucciones:** [`services/identity-service/CLAUDE.md`](../../services/identity-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| fix | Re-hash: una falla al guardar no impide el login, y no pisa una contraseña que cambió mientras tanto | #33 |
| feat | Limpieza periódica de `used_refresh_tokens`, `revoked_refresh_families` y `outbox` (`run_maintenance`) | #32 |
| feat | Tope de 30 días para la sesión: el refresh guarda `auth_time` y no vence más allá de ese tope | #31 |
| feat | Publicar `UserRegistered` en Kafka: schema, outbox en la misma transacción y relay | #28 |
| feat | Re-hash de contraseñas al iniciar sesión; el login pasa a ser un comando (`AuthenticateUserCommand`) | #25 |
| feat | Cerrar sesión (`POST /api/v1/auth/logout`): revoca la familia del refresh token | #24 |
| feat | `GET /api/v1/users/me`: datos del usuario autenticado, primer endpoint de identity que valida un access token | #23 |
| feat | Refresh token (`POST /api/v1/auth/refresh`): rotación y revocación por familia | #22 |
| fix | Auditoría de la base: registro en Consul sin bloquear y repetido cada 60 s, `/docs`, capas, readiness, errores en problem+json, tipos estrictos y workers con hilos | #19 |
| feat | Login: `AuthenticateUserQuery` sin enumeración de emails, `POST /api/v1/auth/login` y JWKS | #15 |
| feat | Firma JWT RS256 con `kid` y `typ`, JWKS, refresh con `aud` propio y validación de la configuración JWT | #14 |
| feat | Registro de usuario, API: repositorio Django, hasher, `POST /api/v1/auth/register` y errores problem+json | #13 |
| feat | Registro de usuario, dominio: agregado `User` inmutable y `RegisterUserCommand` (entró a `main` junto con el #7) | #8 |
| chore | Scaffold: capas, health, registro en Consul, problem+json, correlation-id y Dockerfile | #7 |
| feat | Contrato OpenAPI de identity (registro, login y JWKS) | #6 |

## Pendientes

- [x] Login con JWT RS256 (`kid`) y JWKS
- [x] Refresh token (`POST /api/v1/auth/refresh`) con rotación y revocación
- [x] Borrar periódicamente las filas vencidas de `used_refresh_tokens` y `revoked_refresh_families`
- [x] `GET /api/v1/users/me`
- [x] Cerrar sesión (`POST /api/v1/auth/logout`)
- [x] Re-hashear la contraseña al iniciar sesión cuando Django suba las iteraciones de PBKDF2
- [x] Publicar `UserRegistered` con outbox y relay a Kafka
- [x] Borrar periódicamente las filas ya publicadas de `outbox`
- [x] Duración máxima de la sesión: 30 días desde el login

**Depende de otros**

- Rate limit de registro y login en el gateway ([gateway.md](gateway.md)). **No exponer identity sin él.**
