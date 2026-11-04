# Infraestructura local

Docker Compose con Kafka (KRaft), Kafka UI, Consul y los servicios. Las decisiones están en el [ADR 0002](../docs/adr/0002-gateway-go-balanceador-consul.md).

## Levantar

```bash
bash infra/scripts/generate-env.sh      # una sola vez: crea infra/.env con secretos aleatorios
docker compose -f infra/docker-compose.yml up -d --build
```

| Qué | Dónde |
|---|---|
| UI de Consul | http://127.0.0.1:8500 |
| UI de Kafka | http://127.0.0.1:8090 |

Para trabajar en un servicio, levanta solo lo que necesitas:

```bash
docker compose -f infra/docker-compose.yml up -d identity-service
```

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
