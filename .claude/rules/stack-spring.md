---
paths:
  - "services/listing-service/**"
---

# listing-service — Spring Boot (Java)

Es el servicio de **propiedades** (el "Property Service" del enunciado): datos, galería, características y estados. Es el lado de comandos del catálogo.

También es dueño de **Favoritos**, como agregado `Favorite` separado de `Property` (ver `docs/adr/0003-favoritos-en-listing.md`).

## Estructura (paquete base `com.inmobiliaria.listing`)

```
domain/
  model/          # Property (aggregate root), PropertyId, Money, Location, Area, Feature, PropertyStatus, PropertyImage
                  # Favorite (aggregate root aparte), FavoriteId
  event/          # PropertyPublished, PropertyReserved, ... (eventos de dominio)
  repository/     # PropertyRepository, FavoriteRepository (interfaces)
  exception/      # DomainException, InvalidStateTransitionException
application/
  command/        # PublishPropertyCommand + PublishPropertyHandler, ...
  query/          # GetPropertyByIdQuery + handler, ListAgentPropertiesQuery
  port/           # EventPublisher, ImageStorage, Clock
infrastructure/
  persistence/    # PropertyJpaEntity, SpringDataPropertyRepository, JpaPropertyRepositoryAdapter, mappers
  messaging/      # OutboxEntity, OutboxRelay (@Scheduled), KafkaEventPublisher, mappers a eventos de integración
  storage/        # LocalImageStorage (Adapter)
  config/         # beans, seguridad (resource server JWT con JWKS)
presentation/
  rest/           # PropertyController, DTOs (records), GlobalExceptionHandler (@RestControllerAdvice → ProblemDetail)
```

## Decisiones técnicas

- **Dominio sin Spring.** Nada de `@Entity`, `@Component`, `@Autowired` ni Lombok en `domain`. El aggregate es una clase Java pura; los value objects son `record`.
- **Persistencia:** Spring Data JPA en `infrastructure`, con un mapper explícito entre `PropertyJpaEntity` y `Property`.
- **Migraciones:** Flyway, nombradas con fecha y hora para evitar choques entre ramas: `V20261016_1430__create_property.sql`.
  - Nunca modifiques una migración ya aplicada en `main`.
  - `spring.jpa.hibernate.ddl-auto=validate`.
- **Validación:** Bean Validation (`@Valid`) en los DTOs de `presentation`. Las reglas de negocio van en el aggregate.
- **Errores:** `ProblemDetail` nativo de Spring 6+ con `code` y `correlationId` como propiedades extra.
- **Seguridad:** `spring-boot-starter-oauth2-resource-server` con `jwk-set-uri` apuntando a identity. Los roles se toman del claim `roles`.
- **Kafka:** `spring-kafka`. El `OutboxRelay` publica con `KafkaTemplate` usando como clave el `aggregateId`.
- **Imágenes:** `POST /api/v1/properties/{id}/images` (multipart) → puerto `ImageStorage` (patrón Adapter).
- **OpenAPI:** `springdoc-openapi`, con Swagger UI en `/docs`. Debe coincidir con `contracts/openapi/listing-service.yaml`.
- **Eventos que produce:** `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold` y `PropertyRented` en `listing.property.events`.
- **Favoritos:**
  - El handler que guarda un favorito lee la `Property` y exige que esté `PUBLISHED`. Solo modifica `Favorite`.
  - No se repite un favorito para el mismo par usuario y propiedad.
  - No publica eventos (ADR 0003).

## Registro en Consul

Sigue el contrato de la rule `service-discovery`, con `spring-cloud-starter-consul-discovery`. La versión de Spring Cloud se toma del BOM `spring-cloud-dependencies` compatible con la versión de Spring Boot.

```properties
spring.application.name=listing-service
spring.cloud.consul.host=${CONSUL_HOST:consul}
spring.cloud.consul.port=${CONSUL_PORT:8500}
spring.cloud.consul.discovery.prefer-ip-address=true
spring.cloud.consul.discovery.instance-id=${spring.application.name}-${HOSTNAME}
spring.cloud.consul.discovery.health-check-path=/health
spring.cloud.consul.discovery.health-check-interval=10s
spring.cloud.consul.discovery.health-check-critical-timeout=1m
```

- Spring Cloud apunta por defecto a `/actuator/health`. Hay que mapear Actuator para exponer `GET /health` y `GET /health/ready`:
  - `management.endpoints.web.base-path=/`.
  - `management.endpoints.web.path-mapping.health=health`.
  - Un grupo de health `ready` que incluya la base.
- La baja al apagar la hace la librería (`deregister=true` por defecto).

## Comandos

```bash
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test
./mvnw verify
```

Usa siempre el wrapper (`mvnw`) y commitea `.mvn/wrapper/`, para que todos usen la misma versión de Maven.
