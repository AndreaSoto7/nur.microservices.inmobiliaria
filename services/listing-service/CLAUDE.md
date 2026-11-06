# listing-service — Spring Boot (Java)

Instrucciones para trabajar en este servicio. Complementa al `CLAUDE.md` raíz, que siempre aplica. El servicio ya implementa todo el alcance obligatorio: propiedades, galería, estados, favoritos, catálogo público, outbox y la política `LeadClosed`. Si algo no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | Asa (@AndreaSoto7) |
| Stack | Spring Boot 4.1 · Java 21 · Spring Cloud 2025.1, Maven con wrapper |
| Puerto | 8002 |
| Base | `listing` (PostgreSQL 17) → [`docs/base-de-datos/listing-service.md`](../../docs/base-de-datos/listing-service.md) |
| API | `contracts/openapi/listing-service.yaml` · Swagger UI en `/docs` |
| Rutas del gateway | `/api/v1/properties/**`, `/api/v1/favorites/**`, `/api/v1/catalog/**` (público) |
| Publica | `listing.property.events` |
| Consume | `visit.lead.events` (`LeadClosed`) |
| Progreso | [`docs/progreso/listing-service.md`](../../docs/progreso/listing-service.md) |
| Decisiones | ADR 0003 (favoritos aquí), ADR 0005 (catálogo aquí y política `LeadClosed`) |

## Qué hace y qué no

- **Hace:** el ciclo de vida de una propiedad (borrador → publicada → reservada/vendida/alquilada), galería, características, favoritos, el **catálogo público con filtros** (lado query de CQRS) y la reserva automática cuando una oportunidad se gana.
- **No hace:** consultas, visitas ni oportunidades (visit-service), ni llamar a otro servicio por HTTP.

## Dominio

**Aggregate `Property`** (raíz) con `PropertyImage` (máx. 5) y `Amenity` (extras) dentro. Value objects: `PropertyId`, `Money`, `Location`, `Area`, `PropertyStatus`, `PropertyType`, `OperationType`.

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
| `registerPropertiesCommand` | `UpdatePropertyCharacteristicsCommand` | Dormitorios y baños ≥ 0, superficie > 0, extras válidos | interno; `PropertyUpdated` si está publicada o reservada |
| `publishListingCommand` | `PublishPropertyCommand` | Desde `DRAFT` o `PAUSED`; al menos 1 foto; datos completos | `PropertyPublished` |
| `editListingCommand` | `EditPropertyCommand` | Solo el agente dueño; no si está vendida o alquilada | `PropertyUpdated` si está publicada o reservada |
| `pauseListingCommand` | `PausePropertyCommand` | Solo si está `PUBLISHED` | `PropertyPaused` |
| `reserveListingCommand` | `ReservePropertyCommand` | Solo si está `PUBLISHED` | `PropertyReserved` |
| `cancelListingCommand` | `ReleaseReservationCommand` | Solo si está `RESERVED`; vuelve a `PUBLISHED` | `PropertyPublished` |
| `buyListingCommand` | `MarkPropertySoldCommand` | Solo `SALE`, desde `PUBLISHED` o `RESERVED`; irreversible | `PropertySold` |
| `rentListingCommand` | `MarkPropertyRentedCommand` | Solo `RENT`, desde `PUBLISHED` o `RESERVED` | `PropertyRented` |
| `updateGalleryCommand` | `AddPropertyImagesCommand` | Solo el dueño; JPG/PNG; máx. 5; no si está vendida o alquilada | `PropertyImagesAdded` (interno); `PropertyUpdated` si está publicada o reservada |
| — | `AddFavoriteCommand` / `RemoveFavoriteCommand` | Solo propiedades `PUBLISHED`; sin repetir | — |
| — | `ListAgentPropertiesQuery`, `GetPropertyByIdQuery` | El agente ve las suyas en todos los estados | — |
| — | `SearchCatalogQuery`, `GetCatalogPropertyQuery` | Público; solo `PUBLISHED` y `RESERVED` | — |
| — | `ListMyFavoritesQuery` | Muestra el estado actual de cada propiedad | — |

## Eventos

- **Publica** en `listing.property.events` (clave `propertyId`, retención infinita) con outbox: `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold`, `PropertyRented`. Los payloads llevan lo que visit necesita (`agentId`, `status`, `operationType`, `title`, `zone`) para no llamar por HTTP. Schemas: `contracts/events/listing/property-*.v1.schema.json`. `PropertyPublished` y `PropertyUpdated` llevan el estado completo; `PropertyPaused`, `PropertyReserved` (con `actor`: `AGENT` o `SYSTEM`), `PropertySold` y `PropertyRented`, solo el cambio de estado. `PropertyPublished` lleva `previousStatus`.
- **Consume** `visit.lead.events` (consumer group `listing-service`, desde el principio, idempotente con `processed_events`).

### Política: una oportunidad ganada reserva la propiedad (ADR 0005, 3.1)

`LeadClosed` con `outcome: WON` → `ReservePropertyCommand` con `actor: SYSTEM`.

- Ignora `outcome: LOST`.
- Reserva solo si la propiedad está `PUBLISHED` y el `agentId` del evento es el de la propiedad. Si no, registra un `WARN` y sigue: **no** va a la DLQ (es una regla de negocio, no un error técnico).
- En una transacción: `processed_events` + `UPDATE properties` (con `version`) + `outbox` (`PropertyReserved`) + proyección del catálogo.
- No hay ciclos: listing solo consume `LeadClosed`.

## CQRS: catálogo público

- El lado comando es el aggregate `Property`. El lado consulta es la tabla `property_catalog`, una proyección desnormalizada que se actualiza **en la misma transacción** que cada comando (upsert al publicar, editar o reservar; borrado al pausar, vender o alquilar).
- Endpoints públicos (detalle en el OpenAPI): `GET /api/v1/catalog/properties` con filtros `zone` (sin distinguir mayúsculas), `type`, `operation`, `minPrice`, `maxPrice`, `bedrooms` (mínimo), `features` (todas las pedidas), paginación y orden por `price`, `publishedAt`, `areaM2` o `bedrooms`, y `GET /api/v1/catalog/properties/{propertyId}`.
- Los filtros se arman con un **Builder** (`CatalogCriteria`) y se traducen a SQL con **Specification** (`CatalogSqlSpecifications`). La proyección la escribe `JdbcCatalogProjection` (puerto `CatalogProjection`) y la lee `JdbcCatalogReadModel`.
- La proyección es descartable: `RebuildCatalogHandler` la vacía y la vuelve a llenar desde `properties` en una transacción, sin publicar eventos. Se dispara al arrancar con `CATALOG_REBUILD_ON_STARTUP=true` (`CatalogRebuildRunner`); no tiene endpoint para no tocar el contrato público.

## Estructura (paquete base `com.inmobiliaria.listing`)

```
domain/
  model/          Property (raíz), PropertyId, Money, Location, Area, Amenity, PropertyStatus, PropertyImage, Actor
                  Favorite (raíz aparte), FavoriteId
  event/          PropertyEvent (sealed interface con un record por evento de dominio)
  repository/     PropertyRepository, FavoriteRepository (interfaces)
  exception/      DomainException (→ 409), InvalidStateTransitionException (→ 409), InvalidValueException (→ 400)
application/
  command/        un Command + Handler por caso de uso; PropertyCommandSupport (cargar, verificar dueño, guardar,
                  proyectar y publicar en una transacción); ImageTypeDetector (MIME real por magic bytes)
  query/          SearchCatalogQuery, ListAgentPropertiesQuery, ...; CatalogReadModel y PropertyReadModel (puertos)
  policy/         ReserveOnLeadWonPolicy y LeadClosed (evento ya traducido) (reacciona a LeadClosed)
  port/           EventPublisher, CatalogProjection, ImageStorage, ProcessedEventStore, Clock
  common/         CommandMetadata (actor, usuario, correlationId, causationId), PageRequest, PageResult, ImageUrls
  exception/      PropertyNotFoundException (404), NotPropertyOwnerException (403), FavoriteNotFoundException (404)
infrastructure/
  persistence/    *JpaEntity, PropertyMapper, JpaPropertyRepository, JpaFavoriteRepository,
                  JdbcCatalogProjection, JdbcCatalogReadModel, JdbcPropertyReadModel, CatalogSqlSpecifications
  messaging/      OutboxEventPublisher + PropertyIntegrationEventMapper (dominio → contrato), OutboxRelay (@Scheduled),
                  LeadEventsConsumer + LeadEventTranslator (anti-corruption layer), JdbcProcessedEventStore
  storage/        LocalImageStorage (Adapter, volumen listing-images)
  config/         ApplicationConfig (arma los handlers), SecurityConfig, ProblemJsonSecurityHandler (401/403),
                  KafkaConfig (reintentos + DLQ), OpenApiConfig, SystemClock, ConsulReregistration
  web/            CorrelationIdFilter (X-Correlation-Id → MDC)
presentation/
  rest/           PropertyController, PropertyImageController, CatalogController, FavoriteController, DTOs (records),
                  GlobalExceptionHandler (@RestControllerAdvice → ProblemDetail), ReadinessController
```

## Decisiones técnicas

- **Dominio sin Spring:** nada de `@Entity`, `@Component`, `@Autowired` ni Lombok en `domain`. Aggregates en Java puro; value objects como `record`.
- **Persistencia:** Spring Data JPA en `infrastructure`, con mapper explícito entre `*JpaEntity` y el dominio. `@Version` en `PropertyJpaEntity`.
- **Migraciones:** Flyway, con fecha y hora en el nombre (`V20261016_1430__create_property.sql`). Nunca modifiques una migración ya aplicada en `main`. `spring.jpa.hibernate.ddl-auto=validate`.
- **Validación:** Bean Validation en los DTOs; reglas de negocio en el aggregate.
- **Errores:** `ProblemDetail` de Spring 6+ con `code` y `correlationId`.
- **Seguridad:** `spring-boot-starter-oauth2-resource-server` con `jwk-set-uri` hacia identity; roles del claim `roles`. Configurar el decoder para aceptar `typ=at+jwt` y rechazar `rt+jwt`.
- **Kafka:** `spring-kafka`. El `OutboxRelay` publica con `KafkaTemplate` y clave `aggregateId`.
- **Imágenes:** `POST /api/v1/properties/{id}/images` (multipart, campo `files`) → puerto `ImageStorage` (Adapter). `GET /api/v1/properties/{id}/images/{imageId}` es público y responde 404 si la propiedad está en `DRAFT` o `PAUSED`. El MIME real se detecta por magic bytes (JPG o PNG) y el límite es 5 MB por imagen (rule `seguridad`). Los archivos van a `IMAGE_STORAGE_DIR` (en Docker, el volumen `listing-images`, compartido entre réplicas) con nombre `{propertyId}/{imageId}.{jpg|png}`.
- **Consumidor:** 3 intentos con backoff exponencial y luego `visit.lead.events.dlq`. Un mensaje ilegible va directo a la DLQ. `OUTBOX_RELAY_ENABLED` y `KAFKA_CONSUMER_ENABLED` permiten correr sin Kafka en local.
- **OpenAPI:** `springdoc-openapi` en `/docs` (JSON en `/v3/api-docs`), igual a `contracts/openapi/listing-service.yaml`.

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
./mvnw test                   # corre antes Checkstyle (fase validate)
./mvnw verify
./mvnw checkstyle:check       # solo el linter

# Reconstruir el catálogo público si se desincronizó (desde la raíz del repo)
CATALOG_REBUILD_ON_STARTUP=true docker compose -f infra/docker-compose.yml up -d --force-recreate listing-service
```

Después de reconstruir, vuelve a levantarlo sin la variable para que las réplicas nuevas no repitan el trabajo.

**Linter:** Checkstyle ([ADR 0006](../../docs/adr/0006-linter-java-listing.md)), reglas en `config/checkstyle/checkstyle.xml`. Revisa sin reformatear: 4 espacios, 120 columnas, sin imports sin usar ni comodines, llaves siempre y errores comunes. Si una violación bloquea `./mvnw test`, se arregla el código, no se baja la regla sin acordarlo.

Usa siempre el wrapper y commitea `.mvn/wrapper/`. Tests: JUnit 5 y AssertJ.

- **Dominio y aplicación:** sin Spring, con fakes en memoria (`src/test/.../support`: `PropertyMother`, `InMemoryPropertyRepository`, `FakeEventPublisher`, ...).
- **Contrato de eventos:** `PropertyEventContractTest` valida cada evento contra `contracts/events/` (envelope y payload).
- **Integración:** `ListingApiIntegrationTest` levanta la app contra PostgreSQL real con Testcontainers (migraciones, JPA, catálogo, outbox y la política). Necesita Docker; sin Docker se salta.

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `ddd-clean-architecture`, `api-rest`, `eventos-kafka` (en mensajería), `seguridad`, `service-discovery`, `testing`, `patrones-diseno`, `principios-solid`.
- **Skills:** `/scaffold-servicio listing` (una vez), `/caso-de-uso`, `/nuevo-endpoint`, `/nuevo-evento`, `/aplicar-patron`, `/revisar`, `/crear-pr`.
- **Agente revisor:** `arquitecto-ddd` para dominio y capas; `guardian-contratos` si cambian eventos u OpenAPI; `revisor-seguridad` para imágenes y auth.
