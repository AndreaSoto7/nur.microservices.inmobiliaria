# Progreso — listing-service

- **Responsable:** _(completar)_
- **Stack:** Spring Boot
- **Instrucciones:** [`services/listing-service/CLAUDE.md`](../../services/listing-service/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Scaffold con `/scaffold-servicio listing` (capas, health, Consul, problem+json, Dockerfile)
- [ ] Contrato `contracts/openapi/listing-service.yaml`

**Propiedades (enunciado: agentes)**

- [ ] Crear y editar una propiedad (`Property` con `Money`, `Location`, `Area`, características)
- [ ] Publicar y pausar (`PropertyStatus`)
- [ ] Reservar, liberar la reserva y marcar como vendida o alquilada (máquina de estados de la rule `ddd-clean-architecture`)
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
