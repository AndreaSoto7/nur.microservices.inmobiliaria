-- Aggregate Property (docs/base-de-datos/listing-service.md): la propiedad, sus extras y su galería.
-- favorites y property_catalog llegan en su propia migración, con su caso de uso.

CREATE TABLE properties (
    id              uuid          PRIMARY KEY,
    agent_id        uuid          NOT NULL,                 -- dueño de la publicación (sub del JWT)
    title           varchar(150)  NOT NULL,
    description     varchar(5000) NOT NULL DEFAULT '',
    property_type   varchar(20)   NOT NULL CHECK (property_type  IN ('HOUSE', 'APARTMENT')),
    operation_type  varchar(10)   NOT NULL CHECK (operation_type IN ('SALE', 'RENT')),
    status          varchar(20)   NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'PUBLISHED', 'PAUSED', 'RESERVED', 'SOLD', 'RENTED')),
    price_amount    numeric(14,2) NOT NULL CHECK (price_amount > 0),   -- en RENT, precio mensual
    price_currency  char(3)       NOT NULL DEFAULT 'BOB' CHECK (price_currency = 'BOB'),
    zone            varchar(100)  NOT NULL,
    address         varchar(255),
    latitude        numeric(9,6)  CHECK (latitude  BETWEEN -90  AND 90),
    longitude       numeric(9,6)  CHECK (longitude BETWEEN -180 AND 180),
    bedrooms        smallint      CHECK (bedrooms  >= 0),
    bathrooms       smallint      CHECK (bathrooms >= 0),
    area_m2         numeric(10,2) CHECK (area_m2   > 0),
    published_at    timestamptz,                            -- primera publicación; no cambia al reanudar
    created_at      timestamptz   NOT NULL,
    updated_at      timestamptz   NOT NULL,
    version         bigint        NOT NULL DEFAULT 0,       -- @Version: el agente y la política LeadClosed pueden chocar

    CONSTRAINT properties_coordinates_together  CHECK ((latitude IS NULL) = (longitude IS NULL)),
    CONSTRAINT properties_sold_only_sale        CHECK (status <> 'SOLD'   OR operation_type = 'SALE'),
    CONSTRAINT properties_rented_only_rent      CHECK (status <> 'RENTED' OR operation_type = 'RENT'),
    CONSTRAINT properties_published_has_date    CHECK (status = 'DRAFT'   OR published_at IS NOT NULL),
    CONSTRAINT properties_published_has_details CHECK (status = 'DRAFT'   OR
        (bedrooms IS NOT NULL AND bathrooms IS NOT NULL AND area_m2 IS NOT NULL))
);
CREATE INDEX properties_agent_idx ON properties (agent_id, status);   -- "mis propiedades" del agente

CREATE TABLE property_features (
    property_id  uuid        NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    feature      varchar(30) NOT NULL CHECK (feature ~ '^[A-Z_]+$'),  -- la lista válida la decide el dominio
    PRIMARY KEY (property_id, feature)
);

CREATE TABLE property_images (
    id            uuid         PRIMARY KEY,                -- también es el nombre del archivo: nunca el original
    property_id   uuid         NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    position      smallint     NOT NULL CHECK (position BETWEEN 0 AND 4),   -- 0 = portada
    content_type  varchar(20)  NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    size_bytes    integer      NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
    storage_key   varchar(255) NOT NULL UNIQUE,            -- ruta dentro del adaptador ImageStorage
    uploaded_at   timestamptz  NOT NULL,
    -- Junto con position 0..4, esto limita a 5 imágenes por propiedad.
    -- DEFERRABLE permite reordenar la galería en una sola transacción.
    CONSTRAINT property_images_position_uq UNIQUE (property_id, position) DEFERRABLE INITIALLY DEFERRED
);
