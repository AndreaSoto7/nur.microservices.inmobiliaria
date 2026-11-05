---
name: scaffold-servicio
description: Genera el esqueleto inicial de un microservicio del proyecto (listing, visit o audit) o del gateway, con capas de arquitectura limpia, health checks, registro en Consul, errores problem+json, config por entorno, Dockerfile y stub de OpenAPI, siguiendo el CLAUDE.md del componente. Se usa una sola vez por componente.
argument-hint: "[listing|visit|audit|gateway]"
disable-model-invocation: true
---

# Scaffold de microservicio

Componente: $ARGUMENTS

## Antes de empezar

1. **Lee el `CLAUDE.md` del componente** (`services/<servicio>-service/CLAUDE.md` o `gateway/CLAUDE.md`). La estructura de carpetas, el stack, el puerto, el registro en Consul y los comandos salen de ahí, **exactamente**.
2. Verifica que la carpeta destino no tenga nada más que ese `CLAUDE.md`. Si ya hay código, detente y avisa: esta skill no sobrescribe nada.
3. Lee también las rules `ddd-clean-architecture` (no aplica al gateway) y `service-discovery`.
4. Revisa en `docs/adr/` si ya están fijadas las versiones del stack. Si no, usa la última versión estable o LTS y anótala para registrarla en un ADR.
5. **audit-service:** si el `CLAUDE.md` todavía dice "stack por decidir", detente y propone primero `/adr` para elegirlo.
6. Confirma con el usuario que es el responsable del componente, o que tiene su visto bueno.

## Generación

- **Usa el generador oficial** del stack y después reorganiza a la estructura del `CLAUDE.md`:
  - Spring: proyecto desde start.spring.io con Web, Validation, Data JPA, PostgreSQL, Flyway, Kafka, OAuth2 Resource Server, Actuator y Consul Discovery.
  - NestJS: `npx @nestjs/cli new`.
  - Go: `go mod init github.com/AndreaSoto7/nur.microservices.inmobiliaria/<ruta del componente>`.
- **Pide permiso** antes de instalar dependencias o ejecutar generadores que descargan paquetes.

## Debe incluir (servicios)

- [ ] Las capas `domain/`, `application/`, `infrastructure/` y `presentation/` (o su equivalente del `CLAUDE.md`), con un archivo mínimo en cada una. Sin lógica de negocio todavía.
- [ ] `GET /health` (sin dependencias) y `GET /health/ready`, en el puerto del `CLAUDE.md`.
- [ ] Registro en Consul al arrancar y baja al apagarse (rule `service-discovery` + sección "Registro en Consul" del `CLAUDE.md`).
- [ ] Errores globales en `application/problem+json`, `X-Correlation-Id` y logs en JSON.
- [ ] Validación de JWT con el JWKS de identity, configurable por variable de entorno.
- [ ] Tablas `outbox` y `processed_events` según `docs/base-de-datos/README.md`, si el servicio publica o consume eventos.
- [ ] Configuración por variables de entorno y `.env.example` completo: DB, Kafka, JWKS URL, puerto, `CONSUL_HTTP_ADDR`, `SERVICE_NAME`, `SERVICE_PORT` y `SERVICE_ADDRESS`.
- [ ] `Dockerfile` multi-stage y `.dockerignore`. Sin `container_name` en el compose.
- [ ] `README.md` para personas: cómo correrlo, puerto y variables.
- [ ] `contracts/openapi/<servicio>-service.yaml` con `info`, `servers` y los endpoints de health.
- [ ] Un test de ejemplo que pase (un value object del dominio) y lint configurado (rule `testing`).

## Debe incluir (gateway)

El gateway ya tiene esqueleto (PR #35). Si hubiera que rehacerlo: las carpetas de `gateway/CLAUDE.md`, `cmd/gateway/main.go` con `GET /health` y graceful shutdown, `.env.example`, `Dockerfile`, `README.md` y lint.

## Verificación final

1. Corre build, tests y lint con los comandos del `CLAUDE.md` y muestra el resultado.
2. Si algo del `CLAUDE.md` resultó distinto al generar (versiones, rutas), actualízalo en el mismo PR.
3. Agrega el servicio a `infra/` según `infra/README.md` ("Agregar tu servicio").
4. Termina con la lista de archivos creados y sugiere `/crear-pr` con la rama `chore/<scope>-scaffold`.
