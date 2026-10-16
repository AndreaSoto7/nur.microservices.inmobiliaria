# Registro de patrones de diseño

El enunciado exige patrones **aplicados y justificados**. Cada vez que se implementa uno, se agrega aquí una fila (la skill `/aplicar-patron` lo hace sola). Esta tabla es la base para la defensa del proyecto.

## Aplicados

| Patrón | Categoría | Servicio | Archivo(s) | Problema que resuelve | Por qué este y no otro |
|---|---|---|---|---|---|
| _(vacío: se completa al implementar)_ | | | | | |

## Planificados (candidatos, mover a "Aplicados" al implementarlos)

| Patrón | Categoría | Servicio | Idea |
|---|---|---|---|
| API Gateway | Microservicios | gateway | Único punto de entrada: auth, CORS, rate limit, ruteo |
| Database per Service | Microservicios | todos | Persistencia independiente |
| CQRS | Arquitectura | listing + search | Comandos en listing, lectura optimizada en search |
| Outbox | Integración | identity, listing, visit | Publicación confiable de eventos |
| Repository | DDD | todos | Un repositorio por aggregate; el dominio no conoce el ORM |
| Factory Method | Creacional | listing | `Property.create()` valida distinto según `HOUSE` o `APARTMENT` |
| Builder | Creacional | search | Criterios de búsqueda con muchos filtros opcionales |
| Singleton | Creacional | todos | Productor de Kafka y pool de BD con scope singleton del contenedor de DI |
| Adapter | Estructural | listing | `ImageStorage` → almacenamiento local o MinIO |
| Decorator | Estructural | search | Repositorio con caché que envuelve al real |
| Facade | Estructural | frontend | Facade por feature que oculta el store y la API a los componentes smart |
| Observer / Pub-Sub | Comportamiento | todos | Eventos de dominio y Kafka |
| Strategy | Comportamiento | notification | Canales de notificación intercambiables |
| Command | Comportamiento | visit, listing | Comandos CQRS ejecutados por `CommandBus` |
| State | Comportamiento | listing, visit | Transiciones de `PropertyStatus` y `VisitStatus` |
| Specification | DDD | visit, search | "Se puede solicitar visita si está PUBLISHED"; filtros combinables |
| Smart/Dumb Components | Frontend | frontend | Separar lógica de presentación |
