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

## Enviar consultas sobre una propiedad

- `POST /api/v1/inquiries` requiere un access token de un cliente, un UUID en `Idempotency-Key` y un cuerpo con `propertyId`, `contactName`, `contactEmail` y `message`. `contactPhone` es opcional. La propiedad debe estar publicada en la copia local.
- La respuesta `201` incluye el ID y `Location`. Solo el cliente y el agente asignado pueden abrir `GET /api/v1/inquiries/{inquiryId}` y ver el mensaje y los datos de contacto.
- Si no hay una oportunidad abierta para el cliente y la propiedad, la primera consulta o solicitud de visita la abre. `InquiryReceived` solo lleva identificadores.

## Solicitar y consultar una visita

Configura `DATABASE_URL` y `JWT_JWKS_URL` en el entorno o en el archivo `.env` del servicio. La URL de JWKS debe apuntar a Identity y ser accesible desde donde corre NestJS. Para una prueba local, la base de Visit debe tener una copia de la propiedad en estado `PUBLISHED`.

- `POST /api/v1/visits` requiere un access token de un cliente y un UUID en `Idempotency-Key`. El cuerpo lleva `propertyId`, `proposedAt` en UTC y, opcionalmente, `clientNote`. La respuesta `201` incluye un ID y la cabecera `Location`.
- `GET /api/v1/visits/{visitId}` devuelve la solicitud al cliente que la creó o al agente asignado.

El agente asignado puede usar `POST /api/v1/visits/{visitId}/schedule` con un UUID en `Idempotency-Key` y `scheduledStart` en UTC. La visita dura 60 minutos y se puede consultar su horario por ID.

El agente asignado puede usar `POST /api/v1/visits/{visitId}/reject` con un UUID en `Idempotency-Key` y un cuerpo como `{"reason":"Horario no disponible"}`. Solo se rechazan solicitudes pendientes; el cliente y el agente pueden consultar el motivo por ID.

El cliente que solicitó la visita o el agente asignado puede usar `POST /api/v1/visits/{visitId}/cancel` con un UUID en `Idempotency-Key` y un motivo opcional (`{"reason":"Surgió un imprevisto"}`). Solo se cancela una visita programada antes de que empiece. El horario queda disponible para otra visita.

El agente asignado puede usar `POST /api/v1/visits/{visitId}/complete` con un UUID en `Idempotency-Key`, sin enviar datos en el cuerpo. La visita debe estar programada y haber llegado a su hora de fin. Los participantes pueden consultar la fecha de registro (`completedAt`) por ID.

Visit guarda `InquiryReceived`, `VisitRequested`, `LeadOpened`, `VisitScheduled`, `VisitRejected`, `VisitCancelled` y `VisitCompleted` en `outbox`. Si `KAFKA_BROKERS` está configurado, un publicador dentro de Visit envía los pendientes y actualiza `published_at` al recibir la confirmación de Kafka. Si el proceso se interrumpe entre el envío y el guardado de la confirmación, el mismo `eventId` puede llegar de nuevo.

## Bandeja y listados

- `GET /api/v1/inquiries`: consultas asignadas al agente autenticado. El listado muestra el nombre y la fecha; el correo, teléfono y mensaje quedan en el detalle por ID.
- `GET /api/v1/visits`: visitas asignadas al agente o solicitadas por el cliente autenticado. Si el token tiene ambos roles, se usa el de agente. Admite el filtro `status`, por ejemplo `REQUESTED`.
- Ambos listados admiten `propertyId`, `page` (por defecto 1) y `size` (por defecto 20, máximo 100). El orden por defecto es del más reciente al más antiguo. Se puede usar `sort=createdAt,asc` en consultas y `sort=requestedAt,asc` en visitas para invertirlo.

## Oportunidades y seguimiento

- `GET /api/v1/leads`: oportunidades del agente autenticado. Admite `propertyId`, `status` (`OPEN` o `CLOSED`), paginación y `sort=openedAt,asc`. Por defecto muestra las más recientes primero.
- `POST /api/v1/leads/{leadId}/follow-ups`: el agente asignado registra una `note` obligatoria en una oportunidad abierta. Envía un UUID en `Idempotency-Key`. El `Location` de la respuesta apunta a la nota, accesible solo para el agente asignado. `LeadFollowUpRegistered` no contiene el texto.

- `POST /api/v1/leads/{leadId}/close`: el agente asignado cierra una oportunidad abierta con `outcome` (`WON` o `LOST`) y una `note` opcional. Requiere un UUID en `Idempotency-Key`. Visit emite `LeadClosed` en ambos casos; Listing solo intenta reservar con `WON`.

## Recibir propiedades de Listing

Desde la raíz del repositorio, puedes levantar Kafka y sus topics:

```bash
docker compose --env-file infra/.env.example -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d kafka kafka-init
```

Para NestJS en Windows, configura `KAFKA_BROKERS=127.0.0.1:9092` en el `.env` de Visit y reinicia el proceso. Si Visit corre en Docker con este Compose, configura VISIT_DOCKER_KAFKA_BROKERS con una dirección anunciada por Kafka que sea accesible desde el contenedor. Con el valor vacío Visit puede arrancar para pruebas HTTP aisladas.

El grupo `visit-service` consume `listing.property.events`. Un grupo nuevo empieza desde el primer evento disponible. La proyección guarda el estado en `property_snapshots`. `PropertyReserved` rechaza las visitas pendientes; `PropertySold` y `PropertyRented` también cancelan las programadas que aún no empezaron. Visit confirma el evento después de aplicar la política. Una reentrega retoma las visitas restantes y un evento más antiguo que la copia local no modifica visitas.

## Docker local

Desde la carpeta `services/visit-service`:

```bash
docker compose -f compose.dev.yaml build
docker compose -f compose.dev.yaml run --rm visit-service npm run migration:run
docker compose -f compose.dev.yaml up -d --wait
```

El servicio responde en `http://localhost:8003/health` y PostgreSQL escucha en `127.0.0.1:5435`. Compose guarda los datos en un volumen local. Para detener los contenedores y conservar el volumen, usa `docker compose -f compose.dev.yaml down`.

## Conectar Visit al Gateway

Configura `CONSUL_HTTP_ADDR` con la URL de Consul accesible desde Visit. Visit se registra como `visit-service` al arrancar, y se da de baja al apagar. Consul usa `/health` para comprobar su disponibilidad. Si Visit corre fuera de Docker, usa `SERVICE_ADDRESS` para indicar una dirección accesible desde Consul y el Gateway.

Configura `JWT_JWKS_URL` con la dirección del JWKS de Identity accesible desde Visit. Las peticiones por el Gateway usan el access token de Identity en `Authorization: Bearer <token>`.

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

El modelo de dominio inicia cada visita en `REQUESTED` y exige que la fecha propuesta sea posterior a la fecha de solicitud. La propiedad y sus participantes se referencian por ID. Para incluir las pruebas de los endpoints, configura `VISIT_TEST_DATABASE_URL` con una base PostgreSQL desechable y vuelve a ejecutar `npm test`. Para probar también Kafka, agrega VISIT_TEST_KAFKA_BROKER con la dirección de un broker desechable. El contrato se integró en el PR #39.
