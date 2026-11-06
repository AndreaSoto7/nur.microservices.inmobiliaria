# Infraestructura local

Docker Compose con Kafka (KRaft), Kafka UI, Consul y los servicios. Las decisiones están en el [ADR 0002](../docs/adr/0002-gateway-go-balanceador-consul.md).

## Levantar

```bash
bash infra/scripts/generate-env.sh      # una sola vez: crea infra/.env con secretos aleatorios
docker compose -f infra/docker-compose.yml up -d --build
```

| Qué | Dónde |
|---|---|
| Gateway (API) | http://localhost:8080 |
| Frontend | http://localhost:5173 |
| UI de Consul | http://127.0.0.1:8500 |
| UI de Kafka | http://127.0.0.1:8090 |

Para trabajar en un servicio, levanta solo lo que necesitas:

```bash
docker compose -f infra/docker-compose.yml up -d identity-service
```

El gateway y el frontend publican en todas las interfaces, así que el 8080 y el 5173 deben estar libres en tu máquina.

## Reglas de puertos (ADR 0002)

- **Uso normal y demo** (`docker-compose.yml`): solo se publican el gateway (8080) y el frontend (5173), más la UI de Consul (8500) y la de Kafka (8090) **solo en `127.0.0.1`**. Los servicios usan su puerto dentro de la red de Docker y se descubren por Consul; así se pueden escalar con `--scale`.
- **Depuración** (`docker-compose.debug.yml`): se publican además, solo en `127.0.0.1`, los servicios (identity 8001, listing 8002, visit 8003, audit 8004, notification 8005), sus PostgreSQL (desde 5433, uno por servicio, para no chocar con un Postgres local en 5432) y Kafka (9092).
- **Ningún servicio usa `container_name`**: impide escalar.
- **`visit-migrate` termina y queda en `Exited (0)`:** aplica las migraciones de visit una vez y sale. Es lo esperado, y `visit-service` lo espera antes de arrancar.

## Depurar desde el host

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d
```

Publica, **solo en `127.0.0.1`**: identity en 8001, su PostgreSQL en 5433 y Kafka en 9092. No se combina con `--scale`.

## Agregar tu servicio

En tu propio PR:
1. Agrega tu servicio y su base a `docker-compose.yml`, sin `container_name` y sin publicar puertos.
2. Agrega sus puertos de depuración a `docker-compose.debug.yml`, con `127.0.0.1`.
3. Agrega sus secretos a `scripts/generate-env.sh` y a `.env.example`.
4. Pon `DJANGO_DEBUG=false` o el equivalente de tu stack en `environment:`.

## Apagar

```bash
docker compose -f infra/docker-compose.yml down        # conserva los datos
docker compose -f infra/docker-compose.yml down -v     # borra también los datos
```
