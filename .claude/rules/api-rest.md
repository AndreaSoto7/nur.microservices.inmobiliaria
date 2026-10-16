---
paths:
  - "services/**"
  - "gateway/**"
  - "contracts/openapi/**"
---

# Buenas prácticas de APIs REST

Una API profesional se entiende rápido, falla de forma clara y se puede operar en producción.

## Recursos y rutas

- Sustantivos en plural y kebab-case, bajo `/api/v1`: `/api/v1/properties`, `/api/v1/properties/{propertyId}/images`.
- Como máximo dos niveles de anidación.
- **Transiciones de dominio** que no son un simple update se exponen como sub-recurso de acción con `POST`:
  - `POST /properties/{id}/publish`, `/pause`, `/reserve`, `/release-reservation`, `/mark-sold`, `/mark-rented`
  - `POST /visits/{id}/schedule`, `/reject`, `/cancel`, `/complete`
  - Cada una corresponde a un comando de CQRS.
- Las colecciones se filtran según quién llama: `GET /visits` devuelve las visitas del cliente o las del agente según el rol del JWT. No uses rutas `/me/...` que crucen servicios.

### Mapa de rutas del gateway

| Prefijo | Servicio |
|---|---|
| `/api/v1/auth/**`, `/api/v1/users/**` | identity |
| `/api/v1/properties/**` | listing (comandos y detalle para el agente) |
| `/api/v1/search/**` | search (catálogo público y filtros) |
| `/api/v1/inquiries/**`, `/api/v1/visits/**`, `/api/v1/leads/**` | visit |
| `/api/v1/favorites/**` | por decidir (ADR) |
| `/api/v1/notifications/**` | notification |

## Métodos HTTP con su semántica real

| Método | Uso | Idempotente | Respuesta típica |
|---|---|---|---|
| `GET` | Leer, sin efectos secundarios | Sí | 200 |
| `POST` | Crear o ejecutar una acción de dominio | No (usa `Idempotency-Key`) | 201 + `Location`, o 200/202 |
| `PUT` | Reemplazo completo | Sí | 200 / 204 |
| `PATCH` | Actualización parcial (JSON Merge Patch) | Debería serlo | 200 |
| `DELETE` | Eliminar | Sí | 204 |

## Status codes

| Código | Cuándo |
|---|---|
| 200 / 201 / 204 | Éxito con body / recurso creado / éxito sin body |
| 400 | Request mal formado o validación de campos |
| 401 | Falta el token o es inválido |
| 403 | Autenticado pero sin permiso (p. ej. un agente editando una propiedad ajena) |
| 404 | El recurso no existe, o el usuario no debe saber que existe |
| 409 | Conflicto de estado o regla de negocio (transición inválida, duplicado) |
| 422 | `Idempotency-Key` reutilizada con un body distinto |
| 429 | Rate limit |
| 500 | Error inesperado (sin stack trace en la respuesta) |

## Errores estructurados (RFC 9457)

`Content-Type: application/problem+json`

```json
{
  "type": "https://inmobiliaria.local/problems/invalid-state-transition",
  "title": "Transición de estado inválida",
  "status": 409,
  "detail": "No se puede marcar como vendida una propiedad en estado PAUSED",
  "instance": "/api/v1/properties/7b1e.../mark-sold",
  "code": "PROPERTY_INVALID_TRANSITION",
  "correlationId": "c0a8...",
  "errors": [{ "field": "price.amount", "message": "debe ser mayor a 0" }]
}
```

`code` es estable y está en `UPPER_SNAKE_CASE`, prefijado por el aggregate. `errors` solo aparece en los errores de validación.

## Filtros, paginación y ordenamiento

```
GET /api/v1/search/properties?zone=equipetrol&type=HOUSE&operation=SALE
    &minPrice=50000&maxPrice=150000&bedrooms=3&features=GARAGE,POOL
    &page=1&size=20&sort=price,asc
```

- `page` empieza en 1. `size` vale 20 por defecto y como máximo 100. `sort=campo,asc|desc` y se puede repetir.
- **Respuesta de una colección:**
  ```json
  { "data": [ ... ], "page": { "number": 1, "size": 20, "totalElements": 134, "totalPages": 7 } }
  ```
- **Un recurso individual** se devuelve sin envoltorio.

## Seguridad

- `Authorization: Bearer <jwt>` en todo lo que no es público.
  - Públicos: catálogo, detalle de propiedad, registro, login y JWKS.
- La **autorización de dominio** (¿es el agente dueño de la propiedad?) va en la capa de aplicación, no solo en el gateway.
- CORS y rate limit se configuran **en el gateway**, no en cada servicio.
- Valida toda entrada en `presentation` (formato) y en `domain` (reglas).

## Idempotencia

- `POST /inquiries` y `POST /visits` exigen el header `Idempotency-Key` (UUID).
- Guarda la clave junto con la respuesta durante 24 h:
  - Misma clave y mismo body → misma respuesta.
  - Misma clave y otro body → 422.
- Los consumidores de Kafka también son idempotentes (ver la rule `eventos-kafka`).

## Versionado y compatibilidad

- La versión va en la URI: `/api/v1`.
- **Cambios compatibles** (se pueden hacer en v1):
  - Agregar campos opcionales.
  - Agregar endpoints.
  - Agregar valores de enum, si los clientes toleran valores desconocidos.
- **Cambios que rompen** (exigen `/api/v2` conviviendo con v1 y un ADR):
  - Quitar o renombrar campos.
  - Cambiar tipos.
  - Volver obligatorio un campo opcional.

## OpenAPI, ejemplos y observabilidad

- `contracts/openapi/<servicio>.yaml` (OpenAPI 3.1) es la fuente de verdad. Cada operación tiene `operationId`, ejemplos de request y response, y errores documentados.
- Cada servicio sirve su documentación en `/docs` y expone `GET /health` (liveness) y `GET /health/ready` (readiness).
- Propaga `X-Correlation-Id`; si no llega, lo genera el gateway. Loguea método, ruta, status, duración y correlationId.

## Checklist rápido

- [ ] Recursos claros y nombres consistentes.
- [ ] Métodos HTTP con su semántica real.
- [ ] Status codes correctos y errores estructurados.
- [ ] Filtros, paginación y ordenamiento definidos.
- [ ] Autenticación, autorización, rate limit y CORS.
- [ ] Idempotencia en operaciones críticas.
- [ ] Versionado y compatibilidad hacia atrás.
- [ ] OpenAPI, ejemplos, pruebas y observabilidad.
