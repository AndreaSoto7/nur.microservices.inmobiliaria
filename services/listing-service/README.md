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

Las variables están en [`.env.example`](.env.example). Spring las toma del entorno: expórtalas o cárgalas en la configuración de ejecución del IDE. Para correr sin Kafka, `OUTBOX_RELAY_ENABLED=false` y `KAFKA_CONSUMER_ENABLED=false`.

## Endpoints

| Ruta | Para qué |
|---|---|
| `/api/v1/properties/**` | Propiedades del agente: crear, editar, características, galería y estados (rol `AGENT`) |
| `/api/v1/catalog/properties` | Catálogo público con filtros, paginación y orden (sin token) |
| `/api/v1/favorites/**` | Favoritos del usuario (`CLIENT` o `AGENT`) |
| `GET /api/v1/properties/{id}/images/{imageId}` | Imagen pública de una propiedad publicada o reservada |
| `GET /docs` | Swagger UI (contrato: `contracts/openapi/listing-service.yaml`) |
| `GET /health` | Liveness, lo usa Consul. No revisa dependencias |
| `GET /health/ready` | Readiness: revisa la base |

## Tests

```bash
./mvnw test
```

Antes de los tests corre Checkstyle (`config/checkstyle/checkstyle.xml`); una violación hace fallar el build. Los tests de dominio, aplicación y contrato no necesitan nada. `ListingApiIntegrationTest` levanta PostgreSQL con Testcontainers: necesita Docker y, si no está, se salta. Kafka y Consul nunca hacen falta.
