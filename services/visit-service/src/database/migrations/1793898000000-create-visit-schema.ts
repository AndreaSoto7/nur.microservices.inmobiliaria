import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisitSchema1793898000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- btree_gist permite combinar "=" sobre uuid con "&&" sobre rangos en un mismo índice GiST.
      CREATE EXTENSION IF NOT EXISTS btree_gist;
    `);

    await queryRunner.query(`
      -- Se llena solo con listing.property.events. Nunca la modifica un comando de visit.
      CREATE TABLE property_snapshots (
          property_id     uuid         PRIMARY KEY,
          agent_id        uuid         NOT NULL,
          title           varchar(150) NOT NULL,
          zone            varchar(100) NOT NULL,
          operation_type  varchar(10)  NOT NULL CHECK (operation_type IN ('SALE', 'RENT')),
          status          varchar(20)  NOT NULL
                          CHECK (status IN ('PUBLISHED', 'PAUSED', 'RESERVED', 'SOLD', 'RENTED')),
          last_event_at   timestamptz  NOT NULL,   -- occurredAt del último evento aplicado: los más viejos se ignoran
          updated_at      timestamptz  NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE inquiries (
          id             uuid          PRIMARY KEY,
          property_id    uuid          NOT NULL,
          client_id      uuid          NOT NULL,              -- sub del JWT
          agent_id       uuid          NOT NULL,              -- copiado de la snapshot: la bandeja del agente no necesita joins
          contact_name   varchar(150)  NOT NULL,
          contact_email  varchar(254)  NOT NULL,
          contact_phone  varchar(30),
          message        varchar(2000) NOT NULL CHECK (length(trim(message)) > 0),
          created_at     timestamptz   NOT NULL
      );
      CREATE INDEX inquiries_agent_idx  ON inquiries (agent_id,  created_at DESC);
      CREATE INDEX inquiries_client_idx ON inquiries (client_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE visits (
          id                 uuid         PRIMARY KEY,
          property_id        uuid         NOT NULL,
          client_id          uuid         NOT NULL,
          agent_id           uuid         NOT NULL,           -- copiado de la snapshot al solicitar
          status             varchar(20)  NOT NULL
                             CHECK (status IN ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED')),
          proposed_at        timestamptz  NOT NULL,           -- fecha que propone el cliente (futura al solicitar)
          client_note        varchar(500),
          scheduled_start    timestamptz,                     -- fecha y hora que fija el agente
          scheduled_end      timestamptz,                     -- start + duración fija del dominio (por ejemplo, 1 h)
          resolution_reason  varchar(500),                    -- motivo del agente, o PROPERTY_RESERVED / PROPERTY_UNAVAILABLE
          resolved_by        varchar(10)  CHECK (resolved_by IN ('CLIENT', 'AGENT', 'SYSTEM')),
          resolved_at        timestamptz,                     -- al rechazar, cancelar o completar
          requested_at       timestamptz  NOT NULL,
          updated_at         timestamptz  NOT NULL,
          version            bigint       NOT NULL DEFAULT 0, -- @VersionColumn: agente, cliente y políticas pueden chocar

          CONSTRAINT visits_scheduled_has_slot   CHECK (status NOT IN ('SCHEDULED', 'COMPLETED') OR
                                                        (scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL)),
          CONSTRAINT visits_slot_order           CHECK (scheduled_end > scheduled_start),
          CONSTRAINT visits_rejected_has_reason  CHECK (status <> 'REJECTED' OR resolution_reason IS NOT NULL),
          CONSTRAINT visits_closed_has_actor     CHECK (status NOT IN ('REJECTED', 'CANCELLED') OR
                                                        (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)),
          -- "El agente no puede tener otra visita en ese horario": dos visitas SCHEDULED
          -- del mismo agente no pueden cruzarse, ni siquiera si se programan a la vez.
          CONSTRAINT visits_agent_no_overlap EXCLUDE USING gist (
              agent_id WITH =,
              tstzrange(scheduled_start, scheduled_end) WITH &&
          ) WHERE (status = 'SCHEDULED')
      );
      -- "Máximo 1 solicitud pendiente por usuario y propiedad".
      CREATE UNIQUE INDEX visits_one_pending_uq ON visits (client_id, property_id) WHERE status = 'REQUESTED';
      CREATE INDEX visits_agent_idx    ON visits (agent_id, status);
      CREATE INDEX visits_client_idx   ON visits (client_id, requested_at DESC);   -- "estado de mis solicitudes"
      CREATE INDEX visits_property_idx ON visits (property_id, status);           -- lo usan las políticas 3.2 y 3.3
    `);

    await queryRunner.query(`
      CREATE TABLE leads (
          id           uuid          PRIMARY KEY,
          property_id  uuid          NOT NULL,
          client_id    uuid          NOT NULL,
          agent_id     uuid          NOT NULL,
          status       varchar(10)   NOT NULL CHECK (status  IN ('OPEN', 'CLOSED')),
          outcome      varchar(10)            CHECK (outcome IN ('WON', 'LOST')),
          close_note   varchar(2000),
          opened_at    timestamptz   NOT NULL,
          closed_at    timestamptz,
          version      bigint        NOT NULL DEFAULT 0,   -- registrar un seguimiento también lo incrementa

          -- "Resultado obligatorio (ganada / perdida)".
          CONSTRAINT leads_outcome_matches_status CHECK (
              (status = 'OPEN'   AND outcome IS NULL     AND closed_at IS NULL) OR
              (status = 'CLOSED' AND outcome IS NOT NULL AND closed_at IS NOT NULL)
          )
      );
      -- Una sola oportunidad abierta por cliente y propiedad (la política 3.4 no la duplica).
      CREATE UNIQUE INDEX leads_one_open_uq ON leads (client_id, property_id) WHERE status = 'OPEN';
      CREATE INDEX leads_agent_idx ON leads (agent_id, status);

      CREATE TABLE lead_follow_ups (
          id          uuid          PRIMARY KEY,
          lead_id     uuid          NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
          agent_id    uuid          NOT NULL,
          note        varchar(2000) NOT NULL CHECK (length(trim(note)) > 0),   -- "nota obligatoria"
          created_at  timestamptz   NOT NULL
      );
      CREATE INDEX lead_follow_ups_lead_idx ON lead_follow_ups (lead_id, created_at);
    `);

    await queryRunner.query(`
      -- Eventos de integración pendientes de publicar (patrón Outbox).
      -- Se insertan en la misma transacción que el aggregate; el relay los publica y llena published_at.
      CREATE TABLE outbox (
          id            uuid         PRIMARY KEY,          -- = eventId del envelope
          topic         varchar(255) NOT NULL,
          aggregate_id  varchar(36)  NOT NULL,             -- clave del mensaje en Kafka
          envelope      jsonb        NOT NULL,             -- envelope completo, listo para publicar
          created_at    timestamptz  NOT NULL DEFAULT now(),
          published_at  timestamptz
      );
      CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE published_at IS NULL;

      -- Eventos ya procesados por un consumidor (idempotencia: entrega al menos una vez).
      -- Se inserta en la misma transacción que el efecto del evento.
      CREATE TABLE processed_events (
          event_id      uuid         PRIMARY KEY,
          event_type    varchar(100) NOT NULL,
          processed_at  timestamptz  NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE idempotency_records (
          client_id       uuid         NOT NULL,
          operation       varchar(50)  NOT NULL,
          idempotency_key uuid         NOT NULL,
          request_hash    char(64)     NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
          response_status smallint     NOT NULL CHECK (response_status BETWEEN 200 AND 599),
          response_body   jsonb        NOT NULL,
          response_headers jsonb       NOT NULL DEFAULT '{}'::jsonb,
          expires_at      timestamptz  NOT NULL DEFAULT (now() + interval '24 hours'),
          PRIMARY KEY (client_id, operation, idempotency_key)
      );
      CREATE INDEX idempotency_records_expiration_idx ON idempotency_records (expires_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE idempotency_records, processed_events, outbox, lead_follow_ups,
        leads, visits, inquiries, property_snapshots
    `);
    // btree_gist can predate this migration and be used by other tables.
  }
}
