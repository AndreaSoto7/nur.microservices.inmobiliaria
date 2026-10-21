# Contratos HTTP (OpenAPI 3.1)

Hay un archivo por servicio, `<servicio>-service.yaml` (por ejemplo, `listing-service.yaml`), y es la fuente de verdad de su API pública (expuesta vía gateway). El gateway no tiene OpenAPI propio: solo rutea a estas APIs.

| Archivo | Dueño |
|---|---|
| `identity-service.yaml` | responsable de identity |
| `listing-service.yaml` | responsable de listing |
| `visit-service.yaml` | responsable de visit |
| `search-service.yaml` | responsable de search |
| `notification-service.yaml` | responsable de notification |

## Reglas

- **Contract-first:** se edita el YAML antes de implementar (skill `/nuevo-endpoint`).
- Cada operación tiene `operationId`, ejemplos y errores `application/problem+json`.
- Los schemas reutilizables (`Money`, `Location`, `Problem`, `PageMeta`) se definen en `components` de cada archivo. Sí, se duplican entre servicios: es intencional, para no acoplarlos.
- Cambios compatibles en v1. Si algo rompe, se crea `/api/v2` y un ADR.
- Solo el dueño edita su archivo. El frontend y los demás servicios lo leen.
