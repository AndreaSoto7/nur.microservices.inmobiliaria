# listing-service

Propiedades, galería, favoritos y catálogo público de la Plataforma Inmobiliaria. Spring Boot 4.1 · Java 21 · puerto **8002**.

El diseño (dominio, eventos, estructura) está en [`CLAUDE.md`](CLAUDE.md); lo que está hecho y lo que falta, en [`docs/progreso/listing-service.md`](../../docs/progreso/listing-service.md).

## Correr

Con todo el stack (recomendado):

```bash
bash infra/scripts/generate-env.sh      # una sola vez
docker compose -f infra/docker-compose.yml up -d --build listing-service
```

Desde el IDE o la terminal, con la base y Kafka del compose de depuración:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d listing-db kafka consul
cd services/listing-service
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

Las variables están en [`.env.example`](.env.example). Spring las toma del entorno: expórtalas o cárgalas en la configuración de ejecución del IDE.

## Endpoints

| Ruta | Para qué |
|---|---|
| `GET /health` | Liveness, lo usa Consul. No revisa dependencias |
| `GET /health/ready` | Readiness: revisa la base |
| `/api/v1/properties/**` | Propiedades del agente (rol `AGENT`): crear, listar, ver, editar, características, transiciones e imágenes. Detalle en [`contracts/openapi/listing-service.yaml`](../../contracts/openapi/listing-service.yaml) |
| `GET /api/v1/properties/{id}/images/{imageId}` | Imagen pública si la propiedad está en el catálogo |

## Tests

```bash
./mvnw test
```

Los de dominio y aplicación no necesitan nada. Los de integración levantan un PostgreSQL 17 con Testcontainers: necesitan **Docker corriendo**. Los eventos del outbox se validan contra los JSON Schema de `contracts/events/`.
