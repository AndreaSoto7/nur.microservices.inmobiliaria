# Progreso — listing-service

- **Responsable:** _(completar)_
- **Stack:** Spring Boot
- **Rules:** `stack-spring`, `ddd-clean-architecture`, `eventos-kafka`, `service-discovery`

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

**Favoritos (ADR 0003)**

- [ ] Guardar un favorito (solo si la propiedad está `PUBLISHED`), quitarlo y listar los míos

**Eventos**

- [ ] Outbox y relay a Kafka: `PropertyPublished`, `PropertyUpdated`, `PropertyPaused`, `PropertyReserved`, `PropertySold`, `PropertyRented` (primero los schemas en `contracts/events/`)
