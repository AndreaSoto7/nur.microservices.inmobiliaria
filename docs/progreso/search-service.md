# Progreso — search-service

- **Responsable:** _(completar)_
- **Stack:** Go
- **Rules:** `stack-go`, `ddd-clean-architecture`, `eventos-kafka`, `service-discovery`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

**Base**

- [ ] Decidir la base de datos (ADR pendiente: PostgreSQL vs. OpenSearch)
- [ ] Scaffold con `/scaffold-servicio search`
- [ ] Contrato `contracts/openapi/search-service.yaml`

**Catálogo (lado query de CQRS)**

- [ ] Proyección del catálogo: consumir `listing.property.events` con upsert por `propertyId`, idempotente
- [ ] Decidir cómo filtrar por precio con dos monedas: hoy `minPrice`, `maxPrice` y `sort=price` no distinguen USD de BOB
- [ ] Comparar `zone` sin distinguir mayúsculas
- [ ] Buscar con filtros: zona, tipo, operación, precio, dormitorios y características, con paginación y orden
- [ ] Detalle de una propiedad
