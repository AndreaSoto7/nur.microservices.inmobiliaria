---
paths:
  - "contracts/events/**"
  - "services/**/*event*"
  - "services/**/*Event*"
  - "services/**/*kafka*"
  - "services/**/*Kafka*"
  - "services/**/*messaging*"
  - "services/**/*outbox*"
  - "services/**/*Outbox*"
  - "services/**/*consumer*"
  - "services/**/*Consumer*"
  - "infra/**"
---

# Eventos y Kafka

El catálogo oficial de eventos, sus topics, productores y consumidores está en `contracts/events/README.md`. Si un evento no está ahí, no existe.

## Topics y claves

- **Un topic por aggregate:** `<servicio>.<aggregate>.events`, por ejemplo `listing.property.events`, `visit.visit.events` o `identity.user.events`.
- **La clave del mensaje es el `aggregateId`.** Así Kafka garantiza el orden de los eventos de una misma propiedad o visita.
- **Dead-letter:** `<topic>.dlq`.
- **Consumer group:** el nombre del servicio consumidor (`search-service`, `notification-service`, …).

## Envoltorio (envelope) obligatorio

Todos los eventos usan `contracts/events/envelope.schema.json`, serializados como JSON en camelCase:

```json
{
  "eventId": "uuid",
  "eventType": "PropertyPublished",
  "eventVersion": 1,
  "occurredAt": "2026-10-16T14:30:00Z",
  "producer": "listing-service",
  "aggregateType": "Property",
  "aggregateId": "uuid",
  "correlationId": "uuid",
  "payload": { }
}
```

Cada `payload` tiene su schema en `contracts/events/<servicio>/<evento-kebab>.v<N>.schema.json`.

## Productor

- **Patrón Outbox.** En la misma transacción en que se guarda el aggregate, se inserta el evento en la tabla `outbox`. Un relay publica en Kafka y marca la fila como enviada.
  - Nunca publiques en Kafka dentro de la transacción de base de datos ni antes del commit.
- Configura el productor con `acks=all` y en modo idempotente cuando la librería lo permita.
- El payload lleva lo que los consumidores necesitan para no tener que llamarte por HTTP (*event-carried state transfer*), sin datos sensibles. Ejemplo: `PropertyPublished` lleva precio, zona, tipo, dormitorios, características e imagen de portada.

## Consumidor

- **Entrega al menos una vez → el consumidor es idempotente.** Guarda los `eventId` procesados (tabla `processed_events`) e ignora los duplicados.
- Para proyecciones (search-service), haz upsert por `aggregateId` e ignora los eventos con `occurredAt` anterior al último aplicado.
- **Errores:**
  - Reintenta con backoff (3 intentos).
  - Si sigue fallando, manda el mensaje a `<topic>.dlq` con el error y continúa.
  - Nunca te quedes en un loop infinito ni tumbes el consumidor.
- **Ignora** los `eventType` que no conoces, sin fallar. Así se pueden agregar eventos nuevos al topic sin romperte.
- Traduce el evento a tu propio modelo (anti-corruption layer). No reutilices clases del productor.

## Versionado de eventos

- **Cambios compatibles** (se mantiene la versión): agregar campos opcionales.
- **Cambios que rompen** (renombrar o quitar campos, cambiar tipos o semántica):
  - Se crea `eventVersion: N+1` con un schema nuevo `v<N+1>`.
  - El productor publica ambas versiones hasta que los consumidores migren.
  - Se registra en un ADR.
- **Flujo:** primero un PR a `contracts/events/` revisado por los responsables de los servicios consumidores. Después, la implementación.

## Desarrollo local

- Kafka corre en modo KRaft (sin Zookeeper) dentro de `infra/docker-compose.yml`. Kafka UI está en `http://localhost:8090`.
- Los topics se crean explícitamente en el compose o en un script de init. No dependas de la autocreación.
