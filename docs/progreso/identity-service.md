# Progreso — identity-service

- **Responsable:** @Tiesol
- **Stack:** Django 5.2 LTS + DRF, Python 3.13
- **Rules:** `stack-django`, `ddd-clean-architecture`, `service-discovery`, `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Login: `AuthenticateUserQuery` sin enumeración de emails, `POST /api/v1/auth/login` y JWKS | #11 |
| feat | Firma JWT RS256 con `kid` y `typ`, JWKS, refresh con `aud` propio y validación de la configuración JWT | #10 |
| feat | Registro de usuario: agregado `User` inmutable, `RegisterUserCommand` y `POST /api/v1/auth/register` | #8, #9 |
| chore | Scaffold: capas, health, registro en Consul, problem+json, correlation-id y Dockerfile | #7 |
| feat | Contrato OpenAPI de identity (registro, login y JWKS) | #6 |

## Pendientes

- [x] Login con JWT RS256 (`kid`) y JWKS (#10, #11)
- [ ] Refresh token (`POST /api/v1/auth/refresh`) con rotación y revocación
- [ ] `GET /api/v1/users/me`
- [ ] Re-hashear la contraseña al iniciar sesión cuando Django suba las iteraciones de PBKDF2 (como efecto aparte, fuera de la consulta)
- [ ] Publicar `UserRegistered` con outbox y relay a Kafka. Necesita `infra/` con Kafka, el schema del evento en `contracts/events/` y definir la unidad de trabajo (usuario + outbox en la misma transacción)

**Depende de otros**

- Rate limit de registro y login en el gateway ([gateway.md](gateway.md)). **No exponer identity sin él.**
