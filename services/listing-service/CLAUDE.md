# listing-service — Spring Boot (Java)

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica. Ya está el esqueleto y el dominio `Property`; el resto es el diseño acordado. Si algo no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | _(completar)_ |
| Stack | Spring Boot 4.1 · Java 21 · Spring Cloud 2025.1, Maven con wrapper |
| Puerto | 8002 |
| Base | `listing` (PostgreSQL 17) → [`docs/base-de-datos/listing-service.md`](../../docs/base-de-datos/listing-service.md) |
| API | `contracts/openapi/listing-service.yaml` · Swagger UI en `/docs` (pendiente) |
| Rutas del gateway | `/api/v1/properties/**`, `/api/v1/favorites/**`, `/api/v1/catalog/**` (público) |
| Publica | `listing.property.events` |
| Consume | `visit.lead.events` (`LeadClosed`) |
| Progreso | [`docs/progreso/listing-service.md`](../../docs/progreso/listing-service.md) |
| Decisiones | ADR 0003 (favoritos aquí), ADR 0005 (catálogo aquí y política `LeadClosed`) |

## Qué hace y qué no

- **Hace:** el ciclo de vida de una propiedad (borrador → publicada → reservada/vendida/alquilada), galería, características, favoritos, el **catálogo público con filtros** (lado query de CQRS) y la reserva automática cuando una oportunidad se gana.
- **No hace:** consultas, visitas ni oportunidades (visit-service), ni llamar a otro servicio por HTTP.

## Dominio

**Aggregate `Property`** (raíz) con `PropertyImage` (máx. 5) y `Feature` dentro. Value objects: `PropertyId`, `Money`, `Location`, `Area`, `PropertyStatus`, `PropertyType`, `OperationType`.

Máquina de estados (toda otra transición lanza un error de dominio → 409):

| Desde | Método | Hacia | Evento de integración |
|---|---|---|---|
| `DRAFT` | `publish()` | `PUBLISHED` | `PropertyPublished` |
| `PUBLISHED` | `pause()` | `PAUSED` | `PropertyPaused` |
| `PAUSED` | `publish()` | `PUBLISHED` | `PropertyPublished` |
| `PUBLISHED` | `reserve()` | `RESERVED` | `PropertyReserved` |
| `RESERVED` | `releaseReservation()` | `PUBLISHED` | `PropertyPublished` (`previousStatus: RESERVED`) |
| `PUBLISHED` / `RESERVED` | `markSold()` (solo `SALE`) | `SOLD` | `PropertySold` |
| `PUBLISHED` / `RESERVED` | `markRented()` (solo `RENT`) | `RENTED` | `PropertyRented` |

**Aggregate `Favorite`** (ADR 0003): `userId` + `propertyId` (por ID), único por par. Solo se guarda si la propiedad está `PUBLISHED`; se puede quitar en cualquier estado. No publica eventos.

## Casos de uso (event storming → código)

| Diagrama | Comando o consulta | Regla del diagrama | Evento |
|---|---|---|---|
| `createListingCommand` | `CreatePropertyCommand` | Tipo y operación válidos, precio > 0 y zona obligatorios; nace en `DRAFT` | `PropertyCreated` (interno) |
| `registerPropertiesCommand` | `UpdatePropertyFeaturesCommand` | Dormitorios y baños ≥ 0, superficie > 0, extras válidos | interno; `PropertyUpdated` si está publicada o reservada |
| `publishListingCommand` | `PublishPropertyCommand` | Desde `DRAFT` o `PAUSED`; al menos 1 foto; datos completos | `PropertyPublished` |
| `editListingCommand` | `EditPropertyCommand` | Solo el agente dueño; no si está vendida o alquilada | `PropertyUpdated` si está publicada o reservada |
| `pauseListingCommand` | `PausePropertyCommand` | Solo si está `PUBLISHED` | `PropertyPaused` |
| `reserveListingCommand` | `ReservePropertyCommand` | Solo si está `PUBLISHED` | `PropertyReserved` |
| `cancelListingCommand` | `ReleaseReservationCommand` | Solo si está `RESERVED`; vuelve a `PUBLISHED` | `PropertyPublished` |
| `buyListingCommand` | `MarkPropertySoldCommand` | Solo `SALE`, desde `PUBLISHED` o `RESERVED`; irreversible | `PropertySold` |
| `rentListingCommand` | `MarkPropertyRentedCommand` | Solo `RENT`, desde `PUBLISHED` o `RESERVED` | `PropertyRented` |
| `updateGalleryCommand` | `AddPropertyImagesCommand` | Solo el dueño; JPG/PNG; máx. 5; no si está vendida o alquilada | `PropertyImagesAdded` (interno) |
| — | `AddFavoriteCommand` / `RemoveFavoriteCommand` | Solo propiedades `PUBLISHED`; sin repetir | — |
| — | `ListAgentPropertiesQuery`, `GetPropertyByIdQuery` | El agente ve las suyas en todos los estados | — |
| — | `SearchCatalogQuery`, `GetCatalogPropertyQuery` | Público; solo `PUBLISHED` y `RESERVED` | — |
| — | `ListMyFavoritesQuery` | Muestra el estado actual de cada propiedad | — |

## Eventos

- **Publica** en `listing.property.events` (clave `propertyId`, retención infinita) con outbox: `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold`, `PropertyRented`. Los payloads llevan lo que visit necesita (`agentId`, `status`, `operationType`, `title`, `zone`) para no llamar por HTTP. Schema de referencia: `contracts/events/listing/property-published.v1.schema.json`. Agregar `previousStatus` antes de implementar.
- **Consume** `visit.lead.events` (consumer group `listing-service`, desde el principio, idempotente con `processed_events`).

### Política: una oportunidad ganada reserva la propiedad (ADR 0005, 3.1)

`LeadClosed` con `outcome: WON` → `ReservePropertyCommand` con `actor: SYSTEM`.

- Ignora `outcome: LOST`.
- Reserva solo si la propiedad está `PUBLISHED` y el `agentId` del evento es el de la propiedad. Si no, registra un `WARN` y sigue: **no** va a la DLQ (es una regla de negocio, no un error técnico).
- En una transacción: `processed_events` + `UPDATE properties` (con `version`) + `outbox` (`PropertyReserved`) + proyección del catálogo.
- No hay ciclos: listing solo consume `LeadClosed`.

## CQRS: catálogo público

- El lado comando es el aggregate `Property`. El lado consulta es la tabla `property_catalog`, una proyección desnormalizada que se actualiza **en la misma transacción** que cada comando (upsert al publicar, editar o reservar; borrado al pausar, vender o alquilar).
- Endpoints públicos (propuestos; se confirman en el OpenAPI): `GET /api/v1/catalog/properties` con filtros `zone`, `type`, `operation`, `minPrice`, `maxPrice`, `bedrooms`, `features`, paginación y orden (rule `api-rest`), y `GET /api/v1/catalog/properties/{propertyId}`.
- Los filtros combinables son buen lugar para **Specification** o un **Builder** de criterios (registrar en `docs/patrones-de-diseno.md`).

## Estructura (paquete base `com.inmobiliaria.listing`)

```
domain/
  model/          Property (raíz), PropertyId, Money, Location, Area, Feature, PropertyStatus, PropertyImage, Actor
                  Favorite (raíz aparte), FavoriteId
  event/          PropertyEvent (sealed interface con un record por evento de dominio)
  repository/     PropertyRepository, FavoriteRepository (interfaces)
  exception/      DomainException (→ 409), InvalidStateTransitionException (→ 409), InvalidValueException (→ 400)
application/
  command/        PublishPropertyCommand + PublishPropertyHandler, ...
  query/          SearchCatalogQuery, ListAgentPropertiesQuery, ...
  policy/         ReserveOnLeadWonPolicy (reacciona a LeadClosed)
  port/           EventPublisher, ImageStorage, Clock
infrastructure/
  persistence/    *JpaEntity, Spring Data repositories, adaptadores, mappers, proyección del catálogo
  messaging/      OutboxEntity, OutboxRelay (@Scheduled), KafkaEventPublisher, LeadEventsConsumer, mappers
  storage/        LocalImageStorage (Adapter)
  config/         SecurityConfig (resource server JWT con JWKS), ProblemJsonSecurityHandler (401/403), ConsulReregistration
  web/            CorrelationIdFilter (X-Correlation-Id → MDC)
presentation/
  rest/           controllers, DTOs (records), GlobalExceptionHandler (@RestControllerAdvice → ProblemDetail), ReadinessController
```

## Decisiones técnicas

- **Dominio sin Spring:** nada de `@Entity`, `@Component`, `@Autowired` ni Lombok en `domain`. Aggregates en Java puro; value objects como `record`.
- **Persistencia:** Spring Data JPA en `infrastructure`, con mapper explícito entre `*JpaEntity` y el dominio. `@Version` en `PropertyJpaEntity`.
- **Migraciones:** Flyway, con fecha y hora en el nombre (`V20261016_1430__create_property.sql`). Nunca modifiques una migración ya aplicada en `main`. `spring.jpa.hibernate.ddl-auto=validate`.
- **Validación:** Bean Validation en los DTOs; reglas de negocio en el aggregate.
- **Errores:** `ProblemDetail` de Spring 6+ con `code` y `correlationId`.
- **Seguridad:** `spring-boot-starter-oauth2-resource-server` con `jwk-set-uri` hacia identity; roles del claim `roles`. Configurar el decoder para aceptar `typ=at+jwt` y rechazar `rt+jwt`.
- **Kafka:** `spring-kafka`. El `OutboxRelay` publica con `KafkaTemplate` y clave `aggregateId`.
- **Imágenes:** `POST /api/v1/properties/{id}/images` (multipart) → puerto `ImageStorage` (Adapter). `GET /api/v1/properties/{id}/images/{imageId}` es público y responde 404 si la propiedad está en `DRAFT` o `PAUSED`. Validar el MIME real y 5 MB por imagen (rule `seguridad`).
- **OpenAPI:** `springdoc-openapi` en `/docs`, igual a `contracts/openapi/listing-service.yaml`.

## Registro en Consul

Sigue la rule `service-discovery`, con `spring-cloud-starter-consul-discovery` (versión del BOM `spring-cloud-dependencies` compatible con Spring Boot).

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

- **Health:** `GET /health` es el grupo `live` de Actuator (solo `ping`, publicado con `additional-path=server:/health`). `GET /health/ready` lo sirve `presentation/rest/ReadinessController` con el grupo `ready` (la base), porque `additional-path` solo admite un segmento.
- **Variables:** se usan `CONSUL_HOST` y `CONSUL_PORT` (no `CONSUL_HTTP_ADDR`), porque Spring Cloud Consul pide host y puerto por separado. `SERVICE_NAME` y `SERVICE_PORT` sí son las de la rule. En vez de `SERVICE_ADDRESS`, `SPRING_CLOUD_CONSUL_DISCOVERY_IP_ADDRESS`.
- Si Consul no está, arranca igual (`fail-fast=false`).
- La baja la hace la librería (`deregister=true`). El re-registro cada 60 s lo hace `infrastructure/config/ConsulReregistration` y se corta con el `ContextClosedEvent`, antes de la baja.
- Es el servicio de la demo de balanceo: `--scale listing-service=3`.

## Comandos

```bash
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
./mvnw test
./mvnw verify
```

Usa siempre el wrapper y commitea `.mvn/wrapper/`. Tests: JUnit 5, AssertJ, Mockito, `@WebMvcTest`, `@DataJpaTest`.

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `ddd-clean-architecture`, `api-rest`, `eventos-kafka` (en mensajería), `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`.
- **Skills:** `/scaffold-servicio listing` (una vez), `/caso-de-uso`, `/nuevo-endpoint`, `/nuevo-evento`, `/aplicar-patron`, `/revisar`, `/crear-pr`.
- **Agente revisor:** `arquitecto-ddd` para dominio y capas; `guardian-contratos` si cambian eventos u OpenAPI; `revisor-seguridad` para imágenes y auth.
