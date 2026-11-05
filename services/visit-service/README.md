# visit-service

Base local de Visit en NestJS y TypeScript estricto. Usa Node.js 24 LTS (24.15 o posterior en la serie 24) y npm.

## Ejecutar

Desde la carpeta `services/visit-service`:

```bash
npm ci
npm run start:dev
```

`SERVICE_PORT` configura el puerto del servidor HTTP. El valor predeterminado es 8003.

| Ruta | Respuesta |
| --- | --- |
| `GET /health` | `200 {"status":"UP"}` si el proceso HTTP responde |
| `GET /health/ready` | `200 {"status":"UP"}` si PostgreSQL responde y la tabla de visitas está disponible. En caso contrario devuelve `503 {"status":"DOWN"}` |

## Solicitar y consultar una visita

Configura `DATABASE_URL` y `JWT_JWKS_URL` en el entorno o en el archivo `.env` del servicio. La URL de JWKS debe apuntar a Identity y ser accesible desde donde corre NestJS. Para una prueba local, la base de Visit debe tener una copia de la propiedad en estado `PUBLISHED`.

- `POST /api/v1/visits` requiere un access token de un cliente y un UUID en `Idempotency-Key`. El cuerpo lleva `propertyId`, `proposedAt` en UTC y, opcionalmente, `clientNote`. La respuesta `201` incluye un ID y la cabecera `Location`.
- `GET /api/v1/visits/{visitId}` devuelve la solicitud al cliente que la creó o al agente asignado.

El servicio guarda los eventos `VisitRequested` y `LeadOpened` en la tabla `outbox`. Queda pendiente consumir los eventos de Listing y publicar los eventos de Visit en Kafka.

## Docker local

Desde la carpeta `services/visit-service`:

```bash
docker compose -f compose.dev.yaml build
docker compose -f compose.dev.yaml run --rm visit-service npm run migration:run
docker compose -f compose.dev.yaml up -d --wait
```

El servicio responde en `http://localhost:8003/health` y PostgreSQL escucha en `127.0.0.1:5435`. Compose guarda los datos en un volumen local. Para detener los contenedores y conservar el volumen, usa `docker compose -f compose.dev.yaml down`.

## Migraciones de PostgreSQL desde el host

Crea una base local `visit` en PostgreSQL 17. Configura `DATABASE_URL` en el entorno o en un archivo `.env` a partir de `.env.example`. El ejemplo usa el puerto 5435.

```bash
npm run build
npm run migration:run
npm run migration:show
```

Las migraciones se ejecutan de forma explícita. En una base de desarrollo desechable, `npm run migration:revert` revierte la última migración y elimina sus tablas y datos.

## Verificar

```bash
npm run build
npm run lint
npm test
```

El modelo de dominio inicia cada visita en `REQUESTED` y exige que la fecha propuesta sea posterior a la fecha de solicitud. La propiedad y sus participantes se referencian por ID. Para incluir las pruebas de los endpoints, configura `VISIT_TEST_DATABASE_URL` con una base PostgreSQL desechable y vuelve a ejecutar `npm test`. El contrato se integró en el PR #39.
