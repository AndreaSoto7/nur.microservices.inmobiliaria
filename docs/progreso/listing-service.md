# Progreso — listing-service

- **Responsable:** _(completar)_
- **Stack:** Spring Boot
- **Instrucciones:** [`services/listing-service/CLAUDE.md`](../../services/listing-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Aggregate `Property` con su máquina de estados, value objects (`Money`, `Location`, `Area`, `PropertyImage`) y eventos de dominio, con 30 tests | #41 |
| chore | Esqueleto Spring Boot 4.1: capas, `/health` y `/health/ready`, Consul con re-registro, JWT con JWKS, problem+json, `X-Correlation-Id`, logs JSON, outbox y `processed_events`, Dockerfile y compose | #41 |

## Pendientes

**Base**

- [x] Scaffold con `/scaffold-servicio listing` (capas, health, Consul, problem+json, Dockerfile)
- [x] Contrato `contracts/openapi/listing-service.yaml` (stub con health; faltan los endpoints de negocio)
- [ ] Probar el arranque con Postgres real (`docker compose up listing-service`): el esqueleto se probó sin base
- [ ] `springdoc-openapi` en `/docs`
- [ ] Elegir linter de Java (Spotless o Checkstyle)
- [ ] `Property.reconstitute(...)` para que el mapper cargue una propiedad guardada (sin eventos ni validar transiciones), con test de ida y vuelta
- [ ] Puertos `PropertyRepository` (en `domain/repository`) y `Clock`; errores de aplicación `PropertyNotFoundException` (404) y `NotPropertyOwnerException` (403)
- [ ] Persistencia: migración de `properties`, `property_features`, `property_images`, `*JpaEntity`, mapper y adaptador del repositorio
- [ ] Decidir si agregar una imagen a una propiedad visible emite también `PropertyUpdated` (cambia la portada del catálogo)

**Propiedades (enunciado: agentes)**

- [x] Dominio: `Property` con `Money`, `Location`, `Area`, características, galería y máquina de estados completa, con test de la tabla entera (falta exponerlo)
- [ ] Casos de uso y endpoints: crear y editar una propiedad
- [ ] Casos de uso y endpoints: publicar y pausar
- [ ] Casos de uso y endpoints: reservar, liberar la reserva y marcar como vendida o alquilada
- [ ] Galería de imágenes (`POST /properties/{id}/images`, puerto `ImageStorage`)
- [ ] Listar las propiedades del agente

**Catálogo público, lado query (ADR 0005)**

- [ ] Proyección de lectura propia del catálogo, separada del aggregate `Property`
- [ ] Buscar con filtros: zona (sin distinguir mayúsculas), tipo, operación, precio, dormitorios y características, con paginación y orden
- [ ] Detalle público de una propiedad

**Favoritos (ADR 0003)**

- [ ] Guardar un favorito (solo si la propiedad está `PUBLISHED`), quitarlo y listar los míos

**Eventos**

- [ ] `GET /properties/{propertyId}/images/{imageId}` público (las rutas de `PropertyPublished` apuntan ahí)
- [x] Antes de escribir los schemas: agregar `previousStatus` a `PropertyPublished` para distinguir una propiedad nueva de una reanudada
- [x] Schemas de `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold` y `PropertyRented` en `contracts/events/listing/`
- [ ] Outbox y relay a Kafka: `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold`, `PropertyRented`

**Política (ADR 0005, sección 3.1)**

- [ ] Consumir `visit.lead.events` (idempotente, `processed_events`): con `LeadClosed` y `outcome: WON`, enviar `ReservePropertyCommand` con `actor: SYSTEM`. Solo reserva si está `PUBLISHED` y el agente coincide; si no, `WARN` y sigue
