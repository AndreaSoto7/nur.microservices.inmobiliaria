---
paths:
  - "services/visit-service/**"
---

# visit-service — NestJS (TypeScript)

Es el servicio de **leads y visitas**: consultas de interesados, solicitudes de visita, programación y seguimiento.

## Estructura

```
src/
  main.ts  app.module.ts
  shared/                       # filtro de excepciones problem+json, correlation-id middleware, auth guard (JWKS), health
    discovery/                  # registro y baja en Consul (rule service-discovery)
  visits/
    domain/                     # Visit (aggregate), VisitStatus, VisitId, Schedule (VO), eventos, VisitRepository (interfaz + token)
    application/
      commands/                 # request-visit.command.ts + request-visit.handler.ts, schedule-visit..., cancel-visit...
      queries/                  # list-visits.query.ts + handler
      ports/                    # EventPublisher, Clock
    infrastructure/
      persistence/              # visit.orm-entity.ts, typeorm-visit.repository.ts, mappers
      messaging/                # outbox, kafka producer, consumers de listing (property-snapshot)
    presentation/               # visits.controller.ts, dto/ (class-validator)
    visits.module.ts
  inquiries/  leads/            # misma estructura
test/
```

## Decisiones técnicas

- **CQRS:** `@nestjs/cqrs` con `CommandBus`, `QueryBus` y `EventBus`. Los controladores solo despachan comandos y consultas.
- **Repositorios por token:** la interfaz va en `domain` (`export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY')`) y la implementación se registra en el módulo con `{ provide: VISIT_REPOSITORY, useClass: TypeOrmVisitRepository }`.
- **Persistencia:** TypeORM con migraciones (`synchronize: false` siempre). Los nombres de migración llevan timestamp, así que no chocan entre ramas.
- **Validación:** `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true`. Los DTOs usan `class-validator`.
- **TypeScript estricto:** `strict: true`. Prohibido `any`; usa `unknown` y estrecha el tipo.
- **Errores:** un `ExceptionFilter` global mapea los errores de dominio a problem+json (transición inválida → 409).
- **Kafka:** `@nestjs/microservices` con `Transport.KAFKA` (kafkajs) para consumir. El relay de outbox publica con el productor.
- **Snapshot local de propiedades:** se consume `listing.property.events` para saber si una propiedad está `PUBLISHED` y quién es su agente. No se llama a listing por HTTP.
- **Idempotencia:** un interceptor de `Idempotency-Key` en `POST /inquiries` y `POST /visits`.
- **OpenAPI:** `@nestjs/swagger` en `/docs`. Debe coincidir con `contracts/openapi/visit-service.yaml`.
- **Eventos que produce:** `InquiryReceived`, `VisitRequested`, `VisitScheduled`, `VisitRejected`, `VisitCancelled` y `VisitCompleted`.

## Registro en Consul

Sigue el contrato de la rule `service-discovery`.

- Un `ConsulRegistrationService` en `shared/discovery/` hace el `PUT` de registro con el `fetch` nativo de Node. No hace falta una librería de Consul.
- **Registro:** en `main.ts`, **después** de `await app.listen(...)`.
- **Baja:** `app.enableShutdownHooks()`, y el servicio implementa `OnApplicationShutdown` para darse de baja.
- **IP del contenedor:** `os.hostname()` + `dns.promises.lookup`, salvo que `SERVICE_ADDRESS` venga lleno.
- **Health:** `GET /health` y `GET /health/ready` en un controlador de `shared/`, fuera del prefijo `/api/v1`. Para `ready` se puede usar `@nestjs/terminus`.

## Comandos

```bash
npm ci
npm run start:dev
npm run test
npm run lint
npm run migration:generate -- src/database/migrations/<Nombre>
```

Usa `npm ci` (respeta el lockfile). No cambies de gestor de paquetes y no borres `package-lock.json`.
