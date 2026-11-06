CREATE TABLE notifications (
    id           uuid         PRIMARY KEY,
    recipient_id uuid         NOT NULL,
    type         varchar(40)  NOT NULL CHECK (type IN ('WELCOME', 'VISIT_REQUESTED', 'PROPERTY_RESERVED')),
    message      varchar(255) NOT NULL,
    property_id  uuid,
    visit_id     uuid,
    created_at   timestamptz  NOT NULL,
    read_at      timestamptz
);

-- "Mis avisos, los más nuevos primero", y el filtro de no leídos.
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE processed_events (
    event_id     uuid        PRIMARY KEY,
    processed_at timestamptz NOT NULL
);
