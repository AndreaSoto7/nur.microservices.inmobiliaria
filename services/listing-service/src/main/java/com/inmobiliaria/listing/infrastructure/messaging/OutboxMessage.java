package com.inmobiliaria.listing.infrastructure.messaging;

import java.util.UUID;

/** Una fila del outbox: el envelope completo, listo para publicar con clave aggregateId. */
public record OutboxMessage(UUID id, String topic, String aggregateId, String envelope) {
}
