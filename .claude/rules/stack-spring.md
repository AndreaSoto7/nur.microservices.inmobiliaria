---
paths:
  - "services/listing-service/**"
---

# listing-service — Spring Boot (Java)

Es el servicio de **propiedades** (el "Property Service" del enunciado): datos, galería, características y estados. Es el lado de comandos del catálogo.

## Estructura (paquete base `com.inmobiliaria.listing`)

```
domain/
  model/          # Property (aggregate root), PropertyId, Money, Location, Area, Feature, PropertyStatus, PropertyImage
  event/          # PropertyPublished, PropertyReserved, ... (eventos de dominio)
  repository/     # PropertyRepository (interfaz)
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

## Comandos

```bash
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test
./mvnw verify
```

Usa siempre el wrapper (`mvnw`) y commitea `.mvn/wrapper/`, para que todos usen la misma versión de Maven.
