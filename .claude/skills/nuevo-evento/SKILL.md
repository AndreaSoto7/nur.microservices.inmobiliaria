---
name: nuevo-evento
description: Define o modifica un evento de integración en Kafka (contrato JSON Schema, catálogo, topic, versión) e implementa el productor con outbox y los consumidores idempotentes. Úsala cuando un servicio deba avisar algo a otros, como PropertyPublished, VisitRequested, VisitScheduled, PropertyReserved o PropertySold.
argument-hint: "[NombreEvento] [servicio productor]"
---

# Evento de integración (Kafka)

Evento: $ARGUMENTS

Sigue `.claude/rules/eventos-kafka.md`.

## 1. ¿Ya existe?

Revisa `contracts/events/README.md`:

- **Si existe y hay que cambiarlo:** decide si el cambio es compatible (agregar un campo opcional) o rompe algo. Si rompe, se crea `v<N+1>` y hace falta un ADR.
- **Si no existe:**
  - Nombre en pasado y en PascalCase (`VisitScheduled`).
  - Productor: un solo servicio dueño.
  - Topic: el de su aggregate.
  - Clave: el `aggregateId`.

## 2. Contrato (PR propio, primero)

1. Crea `contracts/events/<servicio>/<evento-kebab>.v<N>.schema.json`:
   - JSON Schema draft 2020-12, solo con el `payload`. El envelope es común.
   - `additionalProperties: true`, para que agregar campos no rompa a nadie.
   - Campos obligatorios mínimos y un ejemplo en `examples`.
2. Agrega la fila al catálogo de `contracts/events/README.md`: evento, versión, productor, topic, consumidores y descripción.
3. El payload incluye lo que los consumidores necesitan, para evitar llamadas HTTP entre servicios. Nunca incluye contraseñas, tokens ni datos personales innecesarios.
4. Sugiere abrir el PR del contrato **con los responsables de los servicios consumidores como revisores** antes de implementar.

## 3. Productor

- El aggregate registra el evento de dominio.
- Un mapper en `infrastructure` lo convierte en evento de integración (envelope + payload).
- Se escribe en `outbox` **en la misma transacción** que el aggregate. El relay publica con la clave `aggregateId`.
- **Test:** el evento producido valida contra su JSON Schema.

## 4. Consumidores (solo en tu servicio)

Si el consumidor es de otra persona, deja anotado lo que necesita y avísale.

- Consumer group = nombre del servicio. Se ignoran los `eventType` desconocidos.
- **Idempotencia:** tabla `processed_events` por `eventId`. En proyecciones, upsert por `aggregateId` y descarte de eventos viejos.
- Reintentos con backoff y luego `<topic>.dlq`.
- Se traduce al modelo propio (anti-corruption layer).
- **Test:** procesar dos veces el mismo evento deja el mismo estado.

## Checklist

- [ ] El schema y el catálogo están actualizados.
- [ ] El envelope es completo (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `aggregateId`, `correlationId`).
- [ ] El productor usa outbox y el consumidor es idempotente.
- [ ] Hay tests de contrato.
