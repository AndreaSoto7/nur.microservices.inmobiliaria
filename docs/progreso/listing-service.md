# Progreso — listing-service

- **Responsable:** Asa (@AndreaSoto7)
- **Stack:** Spring Boot
- **Instrucciones:** [`services/listing-service/CLAUDE.md`](../../services/listing-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Servicio completo: casos de uso de propiedades, galería, favoritos y catálogo público (CQRS), persistencia JPA y proyección, outbox con relay a Kafka, política `LeadClosed` → reserva, API REST, Swagger en `/docs` y contrato OpenAPI, con 127 tests (contrato de eventos e integración con Postgres) | #45 |
| feat | Aggregate `Property` con su máquina de estados, value objects (`Money`, `Location`, `Area`, `PropertyImage`) y eventos de dominio, con 30 tests | #41 |
| chore | Esqueleto Spring Boot 4.1: capas, `/health` y `/health/ready`, Consul con re-registro, JWT con JWKS, problem+json, `X-Correlation-Id`, logs JSON, outbox y `processed_events`, Dockerfile y compose | #41 |

## Pendientes

**Base**

- [x] Scaffold con `/scaffold-servicio listing` (capas, health, Consul, problem+json, Dockerfile)
- [x] Contrato `contracts/openapi/listing-service.yaml` con todos los endpoints de negocio
- [ ] Probar el arranque con `docker compose up listing-service`: la app ya corre contra Postgres real en el test de integración, pero la imagen Docker no se construyó en este PR
- [x] `springdoc-openapi` en `/docs`
- [ ] Elegir linter de Java (Spotless o Checkstyle)
- [x] `Property.reconstitute(...)` para que el mapper cargue una propiedad guardada (sin eventos ni validar transiciones), con test de ida y vuelta
- [x] Puertos `PropertyRepository` (en `domain/repository`) y `Clock`; errores de aplicación `PropertyNotFoundException` (404) y `NotPropertyOwnerException` (403)
- [x] Persistencia: migración de `properties`, `property_features`, `property_images`, `*JpaEntity`, mapper y adaptador del repositorio
- [ ] Decidir si agregar una imagen a una propiedad visible emite también `PropertyUpdated` (hoy el catálogo propio sí actualiza la portada, pero visit no se entera)
- [ ] Reconstruir `property_catalog` desde `properties` (comando de mantenimiento), por si la proyección se desincroniza

**Propiedades (enunciado: agentes)**

- [x] Dominio: `Property` con `Money`, `Location`, `Area`, características, galería y máquina de estados completa, con test de la tabla entera (expuesto por la API)
- [x] Casos de uso y endpoints: crear y editar una propiedad
- [x] Casos de uso y endpoints: publicar y pausar
- [x] Casos de uso y endpoints: reservar, liberar la reserva y marcar como vendida o alquilada
- [x] Galería de imágenes (`POST /properties/{id}/images`, puerto `ImageStorage`)
- [x] Listar las propiedades del agente

**Catálogo público, lado query (ADR 0005)**

- [x] Proyección de lectura propia del catálogo, separada del aggregate `Property`
- [x] Buscar con filtros: zona (sin distinguir mayúsculas), tipo, operación, precio, dormitorios y características, con paginación y orden
- [x] Detalle público de una propiedad

**Favoritos (ADR 0003)**

- [x] Guardar un favorito (solo si la propiedad está `PUBLISHED`), quitarlo y listar los míos

**Eventos**

- [x] `GET /properties/{propertyId}/images/{imageId}` público (las rutas de `PropertyPublished` apuntan ahí)
- [x] Antes de escribir los schemas: agregar `previousStatus` a `PropertyPublished` para distinguir una propiedad nueva de una reanudada
- [x] Schemas de `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold` y `PropertyRented` en `contracts/events/listing/`
- [x] Outbox y relay a Kafka: `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold`, `PropertyRented`

**Política (ADR 0005, sección 3.1)**

- [x] Consumir `visit.lead.events` (idempotente, `processed_events`): con `LeadClosed` y `outcome: WON`, enviar `ReservePropertyCommand` con `actor: SYSTEM`. Solo reserva si está `PUBLISHED` y el agente coincide; si no, `WARN` y sigue
