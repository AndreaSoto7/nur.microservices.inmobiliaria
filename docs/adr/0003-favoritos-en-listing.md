# 0003 — Favoritos dentro de listing-service

- **Estado:** Propuesto
- **Fecha:** 2026-10-20
- **Autores:** @Tiesol

## Contexto

- El enunciado pide que los interesados puedan **guardar propiedades en favoritos**, y sugiere un servicio "Favorite" como referencia, no como obligación.
- El ADR 0001 dejó pendiente dónde vive Favoritos.
- **Regla:** solo se puede guardar como favorita una propiedad que esté publicada.
- La ruta `/api/v1/favorites/**` del gateway estaba bloqueada por esta decisión.

## Opciones consideradas

1. **Servicio propio (`favorite-service`).**
   - Pros: responsabilidad aislada.
   - Contras:
     - Un servicio, una base y un stack más para un modelo muy chico.
     - Para validar que la propiedad está publicada tendría que replicar el estado de las propiedades consumiendo `listing.property.events`, o llamar a listing por HTTP (que la regla de oro 2 no permite).
     - Más infraestructura y un responsable más.
2. **Dentro de visit-service.**
   - Pros: visit ya replica una instantánea de las propiedades para validar las visitas.
   - Contras: mezcla un concepto de catálogo con el seguimiento comercial (consultas, leads, visitas), lo que rompe la cohesión del bounded context.
3. **Dentro de listing-service, como agregado separado de `Property`.**
   - Pros:
     - Listing ya es dueño del estado de la propiedad: la regla "solo publicadas" se valida con datos propios, sin replicar nada.
     - Para listar los favoritos de un usuario, listing ya tiene los datos de cada propiedad.
   - Contras: listing crece y su responsable asume más trabajo.

## Decisión

- **Favoritos vive en `listing-service`, como agregado `Favorite` separado de `Property`.**
- **`Favorite`:**
  - Tiene identidad propia (UUID).
  - Guarda `userId` (el `sub` del JWT) y `propertyId` (referencia por ID, no por objeto) más la fecha.
  - Un usuario no puede repetir un favorito para la misma propiedad.
- **Al guardar un favorito**, el handler lee la `Property` por su repositorio y exige que esté `PUBLISHED`. Se modifica un solo agregado por transacción (`Favorite`), y `Property` solo se lee.
- **Al quitar un favorito** no se valida el estado de la propiedad: se puede quitar aunque ya esté vendida o pausada.
- **Gateway:** `/api/v1/favorites/**` → `listing-service`.
- **Eventos:** por ahora no se publica ninguno de favoritos (YAGNI). Si más adelante otro servicio los necesita (por ejemplo, métricas), se agregan con `/nuevo-evento`.

## Justificación

- La invariante "solo propiedades publicadas" depende del estado de `Property`. Ponerla en el mismo bounded context evita la consistencia eventual y la replicación de datos.
- Separar `Favorite` de `Property` respeta "un agregado por transacción": un favorito nuevo no bloquea ni modifica la propiedad, y muchos usuarios pueden guardar la misma propiedad al mismo tiempo sin conflictos.
- Evitar un servicio nuevo es KISS. El enunciado presenta sus microservicios sugeridos como "referencial".

## Consecuencias

- **Se gana:** la ruta de favoritos queda desbloqueada y la regla se valida sin replicar datos ni hacer llamadas síncronas.
- **Se pierde o se asume:**
  - Listing tiene dos agregados y más endpoints; su responsable debe aprobar este ADR.
  - Si una propiedad favorita se vende o se pausa, el favorito sigue existiendo y la lista de favoritos muestra su estado actual.
- **Hay que hacer ahora:**
  - Actualizar `CLAUDE.md` (lenguaje ubicuo y decisiones pendientes) y el mapa de rutas de la rule `api-rest`.
  - El responsable de listing define los endpoints en `contracts/openapi/listing-service.yaml` con `/nuevo-endpoint`.
