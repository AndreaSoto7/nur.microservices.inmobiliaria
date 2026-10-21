---
name: nuevo-endpoint
description: Crea o modifica un endpoint REST de forma contract-first. Primero actualiza el OpenAPI en contracts/openapi, después implementa el controlador, los DTOs, la autorización y los errores problem+json, y termina con tests. Úsala siempre que se agregue o cambie una ruta HTTP de cualquier microservicio.
argument-hint: "[MÉTODO /ruta] [descripción]"
---

# Endpoint REST contract-first

Endpoint: $ARGUMENTS

Sigue `.claude/rules/api-rest.md` al pie de la letra.

## 1. Diseño (antes de escribir código)

Define y muestra al usuario:

- **Ruta y método** con su semántica real. ¿Es un CRUD o una transición de dominio (`POST /{recurso}/{id}/{accion}`)?
- **Quién puede llamarlo:** público, `CLIENT`, `AGENT`, `ADMIN`, o el dueño del recurso.
- **Request:** body, query params y filtros, paginación y orden si es colección.
- **Responses:** éxito (status y body) y errores posibles (400, 401, 403, 404, 409…), cada uno con su `code`.
- **¿Requiere `Idempotency-Key`?** Sí, si es un `POST` crítico.
- **¿Es un cambio compatible con v1?** Si rompe algo, detente: hace falta un ADR y `/api/v2`.

## 2. Contrato

- Edita `contracts/openapi/<servicio>-service.yaml` (por ejemplo, `listing-service.yaml`) con `operationId`, schemas reutilizables en `components`, ejemplos de request y response, y respuestas de error con `application/problem+json`.
- Si el frontend u otro servicio consume este endpoint, sugiere que el contrato vaya en su propio commit o PR para que lo revisen.

## 3. Implementación

- **presentation:** controlador o view delgado.
  - Valida el formato con DTOs.
  - Despacha el comando o la consulta, mapea la respuesta y devuelve `Location` si crea un recurso.
- **application:** si el caso de uso no existe, créalo con `/caso-de-uso`.
- **Autorización:** el rol se valida en presentation; la propiedad del recurso, en el handler.
- Los errores de dominio se mapean a problem+json en el manejador global, no con `try/catch` en cada controlador.
- La documentación generada por el framework (`/docs`) debe coincidir con el YAML del contrato.

## 4. Tests

- Test de controlador:
  - Status y body del caso feliz.
  - 400 por validación.
  - 401 sin token y 403 con otro rol o con un usuario que no es el dueño.
  - 409 por regla de negocio.
- Si es una colección: paginación y filtros.

## 5. Checklist REST

Recorre el checklist de la rule `api-rest` y reporta cada punto como ✅ o ❌.
