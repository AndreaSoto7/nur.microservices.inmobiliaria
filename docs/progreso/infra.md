# Progreso — infra (zona compartida)

- **Responsable:** Zona compartida: PR revisado por otra persona y aviso al grupo
- **Stack:** Docker Compose
- **Rules:** `service-discovery`, `eventos-kafka`, `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| | _(todavía nada)_ | |

## Pendientes

- [ ] `infra/docker-compose.yml` base: publica solo el gateway, el frontend, la UI de Consul y la UI de Kafka (ADR 0002)
- [ ] `infra/docker-compose.debug.yml`: puertos de los servicios (8001–8005) y de las bases (5433–5437)
- [ ] Kafka en modo KRaft + Kafka UI, con los topics creados explícitamente
- [ ] Consul en modo dev
- [ ] Un PostgreSQL por servicio
- [ ] Cada responsable agrega su servicio al compose, sin `container_name`
