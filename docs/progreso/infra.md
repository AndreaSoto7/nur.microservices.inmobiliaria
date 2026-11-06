# Progreso — infra (zona compartida)

- **Responsable:** Zona compartida: PR revisado por otra persona y aviso al grupo
- **Stack:** Docker Compose
- **Instrucciones:** [`infra/README.md`](../../infra/README.md) y las rules `service-discovery`, `eventos-kafka` y `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | `infra/scripts/demo.py`: `seed` carga cuentas, propiedades con fotos, favoritos, una consulta y visitas; `chains` recorre en vivo las políticas del ADR 0005 (publicar, ganar la oportunidad, reservar y vender) y los avisos, a través del gateway | pendiente |
| feat | visit-service en el compose (`visit-db`, `visit-migrate` y `visit-service`), con `VISIT_DB_PASSWORD` y puertos de depuración 8003 y 5435 | #96 |
| feat | Compose base y de depuración con Kafka KRaft, Kafka UI, Consul, topics e identity | #26 |
| feat | Gateway en el compose (8080). Healthcheck de las bases por TCP: con un volumen nuevo, `pg_isready` por socket daba listo durante la inicialización, y identity moría con `Connection refused` | #69 |
| feat | notification-service y su base en el compose. `start_period` en las bases: un volumen nuevo en una máquina ocupada tardaba más que el healthcheck, y Compose cancelaba el arranque | #85 |

## Pendientes

- [x] `infra/docker-compose.yml` base: publica el gateway y el frontend; la UI de Consul y la de Kafka solo en `127.0.0.1` (ADR 0002)
- [x] `infra/docker-compose.debug.yml`: puertos de los servicios, sus bases y Kafka (9092), todo solo en `127.0.0.1` (hoy, identity en 8001 y su base en 5433)
- [x] Kafka en modo KRaft + Kafka UI, con los topics creados explícitamente; `retention.ms=-1` en `listing.property.events`
- [x] Consul en modo dev
- [ ] Un PostgreSQL por servicio (hoy solo identity; cada responsable agrega el suyo)
- [ ] Cada responsable agrega su servicio al compose, sin `container_name`
