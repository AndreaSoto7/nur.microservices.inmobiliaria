# Progreso — infra (zona compartida)

- **Responsable:** Zona compartida: PR revisado por otra persona y aviso al grupo
- **Stack:** Docker Compose
- **Rules:** `service-discovery`, `eventos-kafka`, `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

- [ ] `infra/docker-compose.yml` base: publica el gateway y el frontend; la UI de Consul y la de Kafka solo en `127.0.0.1` (ADR 0002)
- [ ] `infra/docker-compose.debug.yml`: servicios (8001–8005), bases (5433–5437) y Kafka (9092), todo solo en `127.0.0.1`
- [ ] Kafka en modo KRaft + Kafka UI, con los topics creados explícitamente; `retention.ms=-1` en `listing.property.events`
- [ ] Consul en modo dev
- [ ] Un PostgreSQL por servicio
- [ ] Cada responsable agrega su servicio al compose, sin `container_name`
