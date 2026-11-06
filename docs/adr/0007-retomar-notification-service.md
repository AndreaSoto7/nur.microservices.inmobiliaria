# 0007 — Retomar notification-service para los avisos

- **Estado:** Propuesto
- **Fecha:** 2026-11-06
- **Autores:** @Tiesol
- **Modifica:** [0005](0005-realinear-servicios-y-cadenas-de-eventos.md) (sección 1: `notification-service` vuelve al alcance)

## Contexto

- El ADR 0005 dejó `notification-service` fuera de alcance por tiempo, y pidió un ADR propio para retomarlo.
- El enunciado sugiere un Notification Service para "avisos ante solicitudes, visitas y cambios relevantes". Sin él, un agente no se entera de una solicitud hasta que entra a revisarla.
- El equipo decidió retomarlo porque agrega un consumidor visible de Kafka: otro servicio reacciona a los eventos **sin tocar a los productores**.
- `search-service` sigue fuera: el catálogo ya lo resuelve listing con una proyección propia (ADR 0005, sección 6).
- Hoy nadie consume `identity.user.events` si no se construye `audit-service`.

## Opciones consideradas

### Dónde viven los avisos

1. **Servicio propio.**
   - Pros: separa un dominio distinto; se agrega sin tocar a los productores; cada aviso reacciona a eventos que ya existen.
   - Contras: un servicio más que construir y levantar.
2. **Dentro de visit-service.**
   - Pros: nada nuevo que desplegar.
   - Contras: visit todavía no existe, y tendría que consumir también eventos de identity y listing que no le incumben.
3. **Construir `audit-service` en su lugar.**
   - Pros: también demuestra un consumidor que no toca a los productores.
   - Contras: no está en el enunciado, y no le da nada nuevo al usuario.

### Canales

1. **Solo avisos dentro de la app.**
   - Pros: cumple "avisos" sin guardar datos personales.
   - Contras: el usuario tiene que entrar a la app para verlos.
2. **También email simulado.**
   - Pros: se parece más a un producto real, y justificaría una Strategy de canales.
   - Contras: obliga a copiar y guardar emails, y escribirlos en un log iría contra la rule `seguridad`. El enunciado no lo pide.

### Base de datos

1. **PostgreSQL 17:** el motor de los demás servicios; ya lo conoce el equipo y encaja con la consulta "mis avisos, paginados".
2. **MongoDB:** un motor más que operar, sin un beneficio concreto para este modelo.

## Decisión

- **Servicio propio** `notification-service`, en **Go 1.27** como el gateway, con **PostgreSQL 17** (base `notification`), en el puerto **8005**.
- **Solo avisos dentro de la app.** No guarda emails ni nombres.
- **No publica eventos:** solo consume, así que no agrega ciclos ni necesita `outbox`.
- **API:** `GET /api/v1/notifications` (los del usuario del JWT) y `PATCH /api/v1/notifications/{notificationId}` para marcarlo como leído. El gateway ya tiene la ruta.

### A quién se avisa

| Evento | Destinatario | Tipo de aviso | Estado |
|---|---|---|---|
| `UserRegistered` | El usuario registrado | `WELCOME` | Se implementa ahora |
| `VisitRequested` | El agente de la propiedad | `VISIT_REQUESTED` | Se implementa ahora |
| `PropertyReserved` con `actor: SYSTEM` | El agente de la propiedad | `PROPERTY_RESERVED` | Se implementa ahora |
| `InquiryReceived` | El agente de la propiedad | `INQUIRY_RECEIVED` | Espera el schema de visit |
| `VisitScheduled`, `VisitRejected`, `VisitCancelled` | El cliente | `VISIT_SCHEDULED`, `VISIT_REJECTED`, `VISIT_CANCELLED` | Esperan el schema de visit |

- **`PropertyReserved` solo con `actor: SYSTEM`:** si el agente la reservó desde la API, ya lo sabe. Con `SYSTEM` la reservó la política de `LeadClosed` (ADR 0005, sección 3.1), y sí es una novedad para él.
- **`PropertySold` y `PropertyRented` no avisan:** los marca el propio agente, y a los clientes les llega el `VisitCancelled` de sus visitas.
- **Los eventos sin schema no se implementan todavía:** el catálogo los nombra, pero su payload lo define el responsable de visit (contract-first). Agregar cada uno es una fila más en la traducción del consumidor.

## Justificación

- **Cumple el enunciado** y muestra el beneficio del broker: un servicio nuevo reacciona a eventos existentes sin cambiar a identity, listing ni visit.
- **KISS:** con un solo canal, una Strategy de canales sería una abstracción sin uso. Se agrega cuando exista un segundo canal real.
- **Sin datos personales:** el destinatario es el `sub` del usuario, y el aviso lleva un texto fijo y los IDs relacionados.

## Consecuencias

- **Se gana:**
  - Avisos para agentes y clientes.
  - Un consumidor de `identity.user.events` aunque no se construya audit.
- **Se pierde o se asume:**
  - Un servicio y una base más en el compose. Quien ya tenga `infra/.env` debe agregar `NOTIFICATION_DB_PASSWORD`.
  - Mientras visit no publique sus schemas, solo llegan los avisos marcados como "se implementa ahora".
  - Arranca desde el principio de cada topic, como los demás consumidores: con una base vacía crea los avisos de los eventos que sigan en Kafka. Es inofensivo, porque no se envía nada hacia afuera.
- **Hay que hacer ahora:**
  - [x] `CLAUDE.md`, `docs/enunciado.md`, `docs/progreso/` y `docs/base-de-datos/` (este PR).
  - [x] Ruta del gateway (`/api/v1/notifications/**`, #71).
  - [x] Contrato `contracts/openapi/notification-service.yaml` y consumidores en `contracts/events/README.md`.
  - [x] El servicio, su base y su lugar en el compose.
  - [ ] Pantalla de avisos en el frontend (su responsable).
  - [x] Asignar responsable: @Tiesol.
