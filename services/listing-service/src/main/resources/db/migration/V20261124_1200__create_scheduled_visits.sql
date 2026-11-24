-- Copia local de las visitas confirmadas, alimentada por visit.visit.events (VisitScheduled la agrega;
-- VisitCancelled y VisitCompleted la quitan). Con ella, listing no deja pausar una propiedad con visitas.
-- Sin FK: un evento puede llegar antes de que exista la propiedad en esta base, y la tabla es descartable.
CREATE TABLE scheduled_visits (
    visit_id       uuid         PRIMARY KEY,
    property_id    uuid         NOT NULL,
    scheduled_end  timestamptz  NOT NULL
);
CREATE INDEX scheduled_visits_property_idx ON scheduled_visits (property_id, scheduled_end);
