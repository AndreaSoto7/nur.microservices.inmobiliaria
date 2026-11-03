---
name: scaffold-servicio
description: Genera el esqueleto inicial de un microservicio del proyecto (identity, listing, visit, search o notification) o del gateway, con capas de arquitectura limpia, health checks, registro en Consul, errores problem+json, config por entorno, Dockerfile y stub de OpenAPI. Se usa una sola vez por componente.
argument-hint: "[identity|listing|visit|search|notification|gateway]"
disable-model-invocation: true
---

# Scaffold de microservicio

Servicio: $ARGUMENTS

## Antes de empezar

1. Verifica que la carpeta destino **no existe**: `services/<servicio>-service/`, o `gateway/` para el gateway. Si existe, detente y avisa: esta skill no sobrescribe nada.
2. Lee las rules que correspondan. La estructura de carpetas debe ser **exactamente** la de la rule.
   - **Servicios:** la rule del stack (`.claude/rules/stack-*.md`), `.claude/rules/ddd-clean-architecture.md` y `.claude/rules/service-discovery.md`.
   - **Gateway:** `.claude/rules/stack-gateway.md` y `.claude/rules/service-discovery.md`.
3. Revisa en `docs/adr/` si ya están fijadas las versiones del stack. Si no, usa la última versión estable o LTS y anótala para registrarla en un ADR.
4. Confirma con el usuario que eres el responsable de ese servicio, o que tienes su visto bueno.

## Generación

- **Usa el generador oficial** del stack cuando exista y después reorganiza a las capas de la rule:
  - Django: `django-admin startproject config .`
  - Spring: proyecto desde start.spring.io con Web, Validation, Data JPA, PostgreSQL, Flyway, Kafka, OAuth2 Resource Server, Actuator y Consul Discovery.
  - NestJS: `npx @nestjs/cli new`
  - Go (search, notification): `go mod init github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/<servicio>-service`
  - Gateway: `go mod init github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway`
- **Pide permiso** antes de instalar dependencias o ejecutar generadores que descargan paquetes.

## Debe incluir (servicios)

- [ ] Las carpetas `domain/`, `application/`, `infrastructure/` y `presentation/` (o `interfaces/http/` en Go), con un archivo mínimo en cada una. Sin lógica de negocio todavía.
- [ ] `GET /health` (liveness, sin dependencias) y `GET /health/ready`, en el puerto asignado en `CLAUDE.md`.
- [ ] Registro en Consul al arrancar y baja al apagarse, según la rule `service-discovery` y la sección "Registro en Consul" de la rule del stack. Usa la IP del contenedor y el ID `<servicio>-<hostname>`.
- [ ] Manejo global de errores en `application/problem+json`.
- [ ] Middleware o filtro de `X-Correlation-Id` y logs en JSON.
- [ ] Validación de JWT con el JWKS de identity, configurable por variable de entorno. En identity, la emisión del token.
- [ ] Configuración por variables de entorno y `.env.example` con todas ellas: DB, Kafka, JWKS URL, puerto, `CONSUL_HTTP_ADDR`, `SERVICE_NAME`, `SERVICE_PORT` y `SERVICE_ADDRESS`.
- [ ] Un `Dockerfile` multi-stage y `.dockerignore`. Sin `container_name` en ninguna definición de compose.
- [ ] Un `README.md` del servicio: cómo correrlo, puerto, variables, eventos que produce y consume.
- [ ] `contracts/openapi/<servicio>-service.yaml` con `info`, `servers` y los endpoints de health.
- [ ] Un test de ejemplo que pase (un value object del dominio).
- [ ] Lint y formato configurados según la rule `testing`.

## Debe incluir (gateway)

El gateway no tiene dominio, ni base de datos, ni Kafka, ni OpenAPI propio, y no se registra en Consul. El esqueleto es **mínimo**: el proxy, el balancer, el discovery y la auth se implementan después, cada uno como una tarea propia.

- [ ] Las carpetas de la rule `stack-gateway` (`cmd/gateway/`, `internal/config`, `discovery`, `balancer`, `proxy`, `middleware`, `auth`, `problem`), sin implementar todavía.
- [ ] `cmd/gateway/main.go` con `GET /health` y graceful shutdown.
- [ ] `.env.example` con las variables de la rule `stack-gateway`.
- [ ] Un `Dockerfile` multi-stage y `.dockerignore`.
- [ ] Un `README.md`: cómo correrlo, puerto, variables y tabla de rutas.
- [ ] Lint y formato configurados según la rule `testing`.

## Verificación final

Corre build, tests y lint del servicio y muestra el resultado. Termina con la lista de archivos creados y sugiere `/crear-pr` con la rama `chore/<scope>-scaffold`.
