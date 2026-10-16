---
name: scaffold-servicio
description: Genera el esqueleto inicial de un microservicio del proyecto (identity, listing, visit, search o notification) con capas de arquitectura limpia, health checks, errores problem+json, config por entorno, Dockerfile y stub de OpenAPI. Se usa una sola vez por servicio.
argument-hint: "[identity|listing|visit|search|notification]"
disable-model-invocation: true
---

# Scaffold de microservicio

Servicio: $ARGUMENTS

## Antes de empezar

1. Verifica que `services/<servicio>-service/` **no existe**. Si existe, detente y avisa: esta skill no sobrescribe nada.
2. Lee la rule del stack que corresponde (`.claude/rules/stack-*.md`) y `.claude/rules/ddd-clean-architecture.md`. La estructura de carpetas debe ser **exactamente** la de la rule.
3. Revisa en `docs/adr/` si ya están fijadas las versiones del stack. Si no, usa la última versión estable o LTS y anótala para registrarla en un ADR.
4. Confirma con el usuario que eres el responsable de ese servicio, o que tienes su visto bueno.

## Generación

- **Usa el generador oficial** del stack cuando exista y después reorganiza a las capas de la rule:
  - Django: `django-admin startproject config .`
  - Spring: proyecto desde start.spring.io con Web, Validation, Data JPA, PostgreSQL, Flyway, Kafka, OAuth2 Resource Server y Actuator.
  - NestJS: `npx @nestjs/cli new`
  - Go: `go mod init github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/<servicio>-service`
- **Pide permiso** antes de instalar dependencias o ejecutar generadores que descargan paquetes.

## Debe incluir

- [ ] Las carpetas `domain/`, `application/`, `infrastructure/` y `presentation/` (o `interfaces/http/` en Go), con un archivo mínimo en cada una. Sin lógica de negocio todavía.
- [ ] `GET /health` y `GET /health/ready`, en el puerto asignado en `CLAUDE.md`.
- [ ] Manejo global de errores en `application/problem+json`.
- [ ] Middleware o filtro de `X-Correlation-Id` y logs en JSON.
- [ ] Validación de JWT con el JWKS de identity, configurable por variable de entorno. En identity, la emisión del token.
- [ ] Configuración por variables de entorno y `.env.example` con todas ellas (DB, Kafka, JWKS URL, puerto).
- [ ] Un `Dockerfile` multi-stage y `.dockerignore`.
- [ ] Un `README.md` del servicio: cómo correrlo, puerto, variables, eventos que produce y consume.
- [ ] `contracts/openapi/<servicio>-service.yaml` con `info`, `servers` y los endpoints de health.
- [ ] Un test de ejemplo que pase (un value object del dominio).
- [ ] Lint y formato configurados según la rule `testing`.

## Verificación final

Corre build, tests y lint del servicio y muestra el resultado. Termina con la lista de archivos creados y sugiere `/crear-pr` con la rama `chore/<scope>-scaffold`.
