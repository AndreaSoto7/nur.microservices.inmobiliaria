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
- **Consumer group:** el nombre del servicio consumidor (`visit-service`, `listing-service`, `notification-service`, `audit-service`).
- **Quién consume qué** y las políticas que disparan los eventos: `contracts/events/README.md` y el `CLAUDE.md` de cada servicio.

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
- El payload lleva lo que los consumidores necesitan para no tener que llamarte por HTTP (*event-carried state transfer*), sin datos sensibles (contraseñas, tokens) ni datos personales que ningún consumidor necesita. Ejemplo: `PropertyPublished` lleva precio, zona, tipo, dormitorios, características e imagen de portada.

## Consumidor

- **Entrega al menos una vez → el consumidor es idempotente.** Guarda los `eventId` procesados (tabla `processed_events`) e ignora los duplicados.
- Para proyecciones (la copia de propiedades en visit), haz upsert por `aggregateId` e ignora los eventos con `occurredAt` anterior al último aplicado.
- **Políticas** (un evento que dispara un comando en tu servicio): ver la sección "Políticas" de la rule `ddd-clean-architecture`. Un rechazo por regla de negocio no va a la DLQ.
- **Errores:**
  - Reintenta con backoff (3 intentos).
  - Si sigue fallando, manda el mensaje a `<topic>.dlq` con el error y continúa.
  - Nunca te quedes en un loop infinito ni tumbes el consumidor.
- **Ignora** los `eventType` que no conoces, sin fallar. Así se pueden agregar eventos nuevos al topic sin romperte.
- **Filtra por `(eventType, eventVersion)`** e ignora las versiones que no conoces. Mientras conviven v1 y v2, procesa una sola versión de cada hecho.
- **Todos los consumidores del proyecto arrancan desde el principio del topic** (`fromBeginning`, `auto.offset.reset=earliest`): visit para conocer las propiedades ya publicadas; listing, notification y audit para no perder eventos. Repetir un evento viejo es inofensivo porque el consumidor es idempotente y las reglas de estado lo descartan.
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
- **Retención:** `retention.ms=-1` en `listing.property.events`, sin compactación (el último evento de una propiedad, como `PropertyPaused`, puede no llevar el estado completo). `identity.user.events` usa la retención por defecto, porque lleva datos personales.
