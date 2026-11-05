-- Tablas comunes de mensajería (docs/base-de-datos/README.md).

-- Eventos de integración pendientes de publicar (patrón Outbox).
-- Se insertan en la misma transacción que el aggregate; el relay los publica y llena published_at.
CREATE TABLE outbox (
    id            uuid         PRIMARY KEY,
    topic         varchar(255) NOT NULL,
    aggregate_id  varchar(36)  NOT NULL,
    envelope      jsonb        NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    published_at  timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE published_at IS NULL;

-- Eventos de visit.lead.events ya procesados (idempotencia del consumidor).
CREATE TABLE processed_events (
    event_id      uuid         PRIMARY KEY,
    event_type    varchar(100) NOT NULL,
    processed_at  timestamptz  NOT NULL DEFAULT now()
);
