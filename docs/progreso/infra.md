# Progreso — infra (zona compartida)

- **Responsable:** Zona compartida: PR revisado por otra persona y aviso al grupo
- **Stack:** Docker Compose
- **Instrucciones:** [`infra/README.md`](../../infra/README.md) y las rules `service-discovery`, `eventos-kafka` y `seguridad`

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| chore | Arranque desde la raíz con Compose, reutilizando infraestructura y el frontend con mapa integrado en #137 | este PR |
| fix | Demo compatible con Python 3.10, coordenadas en `chains` y comprobación de nueve avisos por tipo, destinatario y propiedad/visita; recorridos reales y balanceo verificados el 24 de noviembre ([evidencia](../arreglos.md#verificación-funcional--24-de-noviembre-de-2026)) | local, pendiente de PR |
| feat | `demo.py admin`: crea la cuenta de administrador de la demo para el panel de usuarios | #118 |
| feat | `demo.py balance`: réplicas sanas en Consul y reparto round robin del gateway, leído de su log por `X-Correlation-Id`; con `--failover`, Circuit Breaker ante una réplica caída y su recuperación | #103 |
| feat | `infra/scripts/demo.py`: `seed` carga cuentas, propiedades con fotos, favoritos, una consulta y visitas; `chains` recorre en vivo las políticas del ADR 0005 (publicar, ganar la oportunidad, reservar y vender) y los avisos, a través del gateway | #102 |
| feat | visit-service en el compose (`visit-db`, `visit-migrate` y `visit-service`), con `VISIT_DB_PASSWORD` y puertos de depuración 8003 y 5435 | #96 |
| feat | Compose base y de depuración con Kafka KRaft, Kafka UI, Consul, topics e identity | #26 |
| feat | Gateway en el compose (8080). Healthcheck de las bases por TCP: con un volumen nuevo, `pg_isready` por socket daba listo durante la inicialización, y identity moría con `Connection refused` | #69 |
| feat | notification-service y su base en el compose. `start_period` en las bases: un volumen nuevo en una máquina ocupada tardaba más que el healthcheck, y Compose cancelaba el arranque | #85 |

## Pendientes

- [x] `infra/docker-compose.yml` base: publica el gateway y el frontend; la UI de Consul y la de Kafka solo en `127.0.0.1` (ADR 0002)
- [x] `infra/docker-compose.debug.yml`: puertos de los servicios, sus bases y Kafka (9092), todo solo en `127.0.0.1` (hoy, identity en 8001 y su base en 5433)
- [x] Kafka en modo KRaft + Kafka UI, con los topics creados explícitamente; `retention.ms=-1` en `listing.property.events`
- [x] Consul en modo dev
- [x] Un PostgreSQL por servicio: identity, listing, notification y visit (audit-service es opcional y todavía no existe)
- [x] Cada responsable agrega su servicio al compose, sin `container_name` (están los cuatro, más gateway y frontend)
