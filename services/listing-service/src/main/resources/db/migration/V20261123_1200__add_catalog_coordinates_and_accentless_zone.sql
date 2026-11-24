-- El catálogo ya muestra el mapa: guarda las coordenadas de cada propiedad (las dos o ninguna).
ALTER TABLE property_catalog
    ADD COLUMN latitude  numeric(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    ADD COLUMN longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT property_catalog_coordinates_together CHECK ((latitude IS NULL) = (longitude IS NULL));

UPDATE property_catalog c
SET latitude = p.latitude, longitude = p.longitude
FROM properties p
WHERE p.id = c.property_id;

-- zone_normalized pasa a guardarse sin tildes (SearchText): "urubo" y "Uru" encuentran Urubó con LIKE.
-- Se recalcula igual que en Java: sin tildes, un solo espacio entre palabras y en minúsculas.
UPDATE property_catalog
SET zone_normalized = lower(regexp_replace(translate(trim(zone), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇáàäâéèëêíìïîóòöôúùüûñç', 'AAAAEEEEIIIIOOOOUUUUNCaaaaeeeeiiiioooouuuunc'), '\s+', ' ', 'g'));
