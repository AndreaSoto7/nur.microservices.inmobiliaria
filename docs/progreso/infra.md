# Progreso — infra (zona compartida)

- **Responsable:** Zona compartida: PR revisado por otra persona y aviso al grupo
- **Stack:** Docker Compose
- **Rules:** `service-discovery`, `eventos-kafka`, `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Compose base y de depuración con Kafka KRaft, Kafka UI, Consul, topics e identity | #26 |

## Pendientes

- [x] `infra/docker-compose.yml` base: publica el gateway y el frontend; la UI de Consul y la de Kafka solo en `127.0.0.1` (ADR 0002)
- [x] `infra/docker-compose.debug.yml`: servicios (8001–8005), bases (5433–5437) y Kafka (9092), todo solo en `127.0.0.1`
- [x] Kafka en modo KRaft + Kafka UI, con los topics creados explícitamente; `retention.ms=-1` en `listing.property.events`
- [x] Consul en modo dev
- [ ] Un PostgreSQL por servicio (hoy solo identity; cada responsable agrega el suyo)
- [ ] Cada responsable agrega su servicio al compose, sin `container_name`
