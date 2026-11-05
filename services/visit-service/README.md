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
| `GET /health/ready` | `200 {"status":"UP"}` si responde el proceso HTTP. La conexión a PostgreSQL se verifica por separado con `migration:show` |

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

El modelo de dominio inicia cada visita en `REQUESTED` y exige que la fecha propuesta sea posterior a la fecha de solicitud. La propiedad y sus participantes se referencian por ID. La migración crea las tablas de Visit. Queda pendiente conectar el flujo HTTP a PostgreSQL y a los demás servicios. El contrato se revisa en el PR #39.
