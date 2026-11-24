# 0008 — listing conoce las visitas confirmadas para no pausar una propiedad con visitas

- **Estado:** Propuesto
- **Fecha:** 2026-11-24
- **Autores:** @Tiesol
- **Modifica:** [0005](0005-realinear-servicios-y-cadenas-de-eventos.md) (sección de cadenas: agrega `visit.visit.events → listing`)

## Contexto

- La revisión del proyecto pidió que un agente no pueda pausar ("sacar") una publicación que tiene una visita confirmada: el interesado ya tiene día y hora, y la ficha dejaría de verse.
- La regla es de listing (la transición `PUBLISHED → PAUSED`), pero las visitas son de visit. Ningún servicio llama a otro por HTTP (regla de oro 2).

## Opciones consideradas

1. **listing lleva una copia local de las visitas confirmadas, desde `visit.visit.events`.**
   - Pros: listing hace cumplir su propia regla sin preguntarle a nadie; es el mismo patrón que la copia de propiedades de visit (CQRS entre servicios).
   - Contras: consistencia eventual: una visita recién programada tarda unos instantes en llegar.
2. **Solo en el frontend:** el panel del agente consulta las visitas y deshabilita "Pausar".
   - Pros: no toca el backend.
   - Contras: la regla no la hace cumplir el servicio; cualquier cliente de la API la saltea.
3. **visit reacciona a `PropertyPaused` cancelando las visitas.**
   - Pros: no hace falta copia en listing.
   - Contras: es lo contrario de lo pedido: deja pausar y le cancela la visita al interesado.

## Decisión

Opción 1.

- listing consume `visit.visit.events` (consumer group `listing-service`, desde el principio, idempotente con `processed_events`). `VisitScheduled` agrega la visita a `scheduled_visits` con su `scheduledEnd`; `VisitCancelled` y `VisitCompleted` la quitan. El resto se ignora.
- `PausePropertyHandler` responde `409 PROPERTY_HAS_SCHEDULED_VISITS` si la propiedad tiene una visita confirmada que todavía no terminó. Una visita cuyo horario ya pasó no bloquea, aunque el agente no la haya marcado como realizada.
- **Sin ciclos:** listing no publica nada al recibir estos eventos.
- Solo se bloquea pausar. Liberar una reserva devuelve la propiedad a `PUBLISHED` y no afecta a las visitas; vender o alquilar sigue cancelándolas por la política de visit (ADR 0005).

## Consecuencias

- El catálogo de eventos suma a listing como consumidor de `VisitScheduled`, `VisitCancelled` y `VisitCompleted`.
- `visit.visit.events` tiene la retención por defecto de Kafka: si listing se reconstruye desde cero, solo recupera las visitas de ese período. Para la demo alcanza; si hiciera falta, se sube la retención del topic.
- Ventana de consistencia eventual: en los segundos entre que visit programa la visita y listing la registra, todavía se podría pausar.
