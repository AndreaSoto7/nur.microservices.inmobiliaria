# Progreso — search-service

> **Fuera de alcance por tiempo** ([ADR 0005](../adr/0005-realinear-servicios-y-cadenas-de-eventos.md)). El catálogo con filtros pasa al lado query de listing (ver [listing-service.md](listing-service.md)). Se retoma solo si sobra tiempo, con un ADR propio.

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
- [ ] Comparar `zone` sin distinguir mayúsculas
- [ ] Buscar con filtros: zona, tipo, operación, precio, dormitorios y características, con paginación y orden
- [ ] Detalle de una propiedad
