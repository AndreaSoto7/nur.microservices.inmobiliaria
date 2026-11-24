# Arreglos

Lista de lo que salió de la revisión del proyecto, con lo que ya se hizo y lo que falta. Los cambios
de contratos, servicios e interfaz con mapa se integraron en `main` mediante los PRs #121 a #138.
La verificación del 24 de noviembre y los ajustes de arranque y pruebas se proponen en
`codex/run-frontend-map` para revisión del equipo.

## Hechos

### SEBAS: cambiar la interfaz para uso con mapas

- **Frontend:** catálogo con lista y mapa real (OpenStreetMap vía Leaflet). Cada
  propiedad aparece como su precio; al pasar por una fila se ilumina su marcador y al tocar un precio se
  abre una tarjeta con foto. En el celular, un botón "Ver mapa" abre el mapa a pantalla completa. La ficha
  muestra la ubicación con un alfiler. El agente marca la ubicación tocando el mapa, arrastrando el
  alfiler o escribiendo las coordenadas.
- **listing:** el resumen del catálogo trae `latitude` y `longitude` (contrato 0.3.0, migración
  `V20261123_1200`).
- **Demo:** `infra/scripts/demo.py seed` carga coordenadas simuladas por zona y ubica las propiedades ya
  cargadas.

### Buscador por zona (mayúsculas, parte del nombre)

- **listing:** `zone` busca con `LIKE` sobre la zona sin tildes ni mayúsculas: `uru`, `URUBO` y
  `zona urubo` encuentran Urubó. Un `%` que escribe la persona se trata como texto.

### SEBAS: cargar la galería de imágenes y las características

- **Vista previa** de cada foto antes de subirla, con su peso y el error de cada archivo (formato o
  tamaño). Se pueden arrastrar o elegir, y quitar de la lista antes de subir.
- **Las fotos de un borrador o de una propiedad pausada se ven:** listing se las da al agente dueño con
  su token (antes respondía 404 hasta publicar).
- **Quitar una foto ya subida** (`DELETE /properties/{id}/images/{imageId}`). La siguiente pasa a ser la
  portada, y una propiedad publicada no se puede quedar sin fotos.

### No se puede responder las consultas

- **visit:** `POST /inquiries/{id}/reply` (una respuesta, del agente asignado) y evento `InquiryReplied`.
  `GET /inquiries` le devuelve al cliente las consultas que envió.
- **notification:** aviso `INQUIRY_REPLIED` para el cliente.
- **Frontend:** el agente responde desde su bandeja; el cliente tiene "Mis consultas" (menú del usuario)
  con la pregunta y la respuesta.

### Límite de caracteres en el número de teléfono

- El teléfono de una consulta acepta solo dígitos, con un `+` inicial opcional y espacios, guiones o
  paréntesis, y entre 7 y 15 dígitos. Lo valida visit (contrato y dominio), y el formulario no deja
  escribir letras.

### Mensajes de error en la validación de identity

- Los mensajes ya estaban en español. El problema era que un error de dominio (contraseña débil, email
  ya registrado) no decía de qué campo era, y el formulario lo mostraba como error general. Ahora
  identity agrega `errors: [{field, message}]` y el formulario lo muestra junto al campo, sin repetirlo.

### No se ve la nota agregada en el seguimiento de una oportunidad

- **visit:** `GET /leads/{id}/follow-ups` lista las notas, de la más vieja a la más nueva.
- **Frontend:** "Ver notas" en cada oportunidad, abierta o cerrada.

### No se puede pausar una publicación con una visita confirmada

- **listing:** consume `visit.visit.events` y lleva las visitas programadas de cada propiedad
  (`scheduled_visits`, ADR 0008). Pausar una propiedad con una visita futura responde 409
  `PROPERTY_HAS_SCHEDULED_VISITS`.

### Consultar el estado de las solicitudes de visita

- **visit:** mientras la visita está solicitada, el horario puede ir y venir. El agente propone otro
  (`POST /visits/{id}/propose-time`) y el cliente lo acepta (`POST /visits/{id}/accept-proposal`) o
  contrapropone. El agente no puede programar ni proponer un horario que choque con otra visita suya.
  Eventos `VisitTimeProposed` y `VisitScheduled` con `actor`. Migración `1795620000000` (`proposed_by`).
- **notification:** avisos `VISIT_TIME_PROPOSED` (al cliente), `VISIT_TIME_PROPOSED_BY_CLIENT` y
  `VISIT_PROPOSAL_ACCEPTED` (al agente). Migración `0005`.
- **Frontend:**
  - El agente ve sus próximas visitas arriba de las solicitudes. Cada solicitud avisa si choca con
    otra visita o si el horario ya pasó; en esos casos no deja aceptarla. Tiene los botones Aceptar,
    Proponer otro horario y Rechazar. Mientras espera la respuesta del interesado, lo dice.
  - El cliente ve quién propuso el horario: acepta la propuesta del agente o propone otro.
  - "Marcar realizada" abre un diálogo con una nota opcional y cómo quedó el interesado: sigue
    interesado (agrega la nota a la oportunidad), cierra el trato (la gana y reserva la propiedad) o no
    le interesó (la cierra como perdida).

### Pantallas cargadas

- **Editor de propiedad en pasos:** Datos, Ubicación, Detalles, Fotos y Publicar. Lo escrito no se
  pierde al volver atrás. Al crear, el borrador se guarda al terminar los detalles, porque las fotos
  necesitan que exista. Al editar, cada paso guarda sus cambios al pasar a otro. En el celular,
  Atrás y Siguiente quedan fijos abajo.
- **Sin "Mi cuenta":** el nombre y el email se muestran arriba del menú del usuario.
- **Ficha:** "Solicitar una visita" y "Enviar una consulta" ya no se abren a la vez.
- **Celular:** el menú del panel de agente se desliza en una línea. Los botones ya no quedan
  resaltados después de tocarlos.

### Prueba de punta a punta (2026-11-24)

Puntos que salieron al probar el flujo completo.

- **Filtros del catálogo:** lo que se elige (operación, tipo, dormitorios, características) se aplica al
  momento, sin "Buscar". Lo que se escribe (zona y precios) sigue esperando "Buscar" o Enter.
  "Más filtros" ya no se cierra al quitar el último filtro.
- **Ficha:** el precio va a la altura del título, a la derecha. La tarjeta de al lado lleva la
  descripción (con "Leer más" si es larga) y, debajo, cómo contactar: "Ingresa para…" sin sesión, o
  solicitar visita, consulta y favoritos con sesión.
- **Mapas:** la ruedita del mouse hace zoom en el mapa de la ficha y en el de ubicar la propiedad.
- **Avisos:** cada aviso se puede borrar (notification `DELETE /notifications/{id}`, contrato 1.2.0). Un
  aviso borrado no vuelve aunque el evento se reprocese.
- **Editor de propiedad:** usa todo el ancho, con una vista previa en vivo de cómo se ve en el catálogo.
  En el resumen ya no aparece "(marcada en el mapa)".
- **Orden de las fotos:** flechas para mover cada foto y "Hacer portada" (listing
  `PATCH /properties/{id}/images/{imageId}`, contrato 0.4.0). La portada es la que se ve en el catálogo.
- **Galería de la ficha:** flechas y contador sobre la foto, y en el celular se desliza. No pasa sola.
- **Solicitudes, consultas y oportunidades:** el título lleva a la ficha pública, no al editor.
- **Nombre y apellido:** el registro los pide por separado (identity 1.5.0, migración `0004`). Las
  respuestas mantienen `fullName` y el registro todavía acepta `fullName` (obsoleto) para el frontend
  anterior. Dos cuentas de prueba con nombre de una palabra quedaron sin apellido.
- **A quién contactar:** cada solicitud de visita y cada oportunidad muestran el nombre, el email y el
  teléfono del interesado, con enlaces para escribir y llamar. visit guarda lo último que el interesado
  le dio a cada agente (`client_contacts`, por cliente y agente): al consultar, los datos del formulario;
  al pedir una visita, el nombre y el email del token (identity suma el claim `name`) y un teléfono
  opcional. Lo que ya existía se llenó con las consultas.
- **Aviso emergente:** cuando llega un aviso nuevo (se consulta cada 30 s y al recargar), baja un mensaje
  desde arriba con un título según el tipo ("Tienes una nueva consulta") y un botón para ir a verlo. No
  se repite al recargar.
- **Un solo frontend:** el nuevo reemplazó al anterior en `frontend/` y se sirve en el 5173 (Docker,
  nginx). La CSP permite los mosaicos del mapa (`MAP_TILE_ORIGIN`). `frontend-lab/` ya no existe.

## Pendientes

- **Mosaicos del mapa en producción:** los de OpenStreetMap alcanzan para la demo; para más tráfico,
  un proveedor con cuenta (se configura con `VITE_MAP_TILE_URL`).

## Mejora opcional

- Recomendaciones, comparación de propiedades, agentes favoritos o métricas de visualización.

## Verificación funcional — 24 de noviembre de 2026

**Base revisada:** `origin/main` en `6e11b3f`, más los ajustes locales de arranque y pruebas descritos
abajo. **Consigna utilizada:** [enunciado versionado](enunciado.md), que resume el PDF del docente,
incluidos balanceo y discovery. El PDF original no está en el repositorio; la cobertura corresponde a
ese resumen y a los contratos y ADR vigentes.

Se ejecutó el proyecto real `inmobiliaria` mediante `docker compose up -d --build` desde la raíz.
Las peticiones entraron por el gateway, usando cuentas y JWT emitidos por Identity, con Kafka y las
cuatro bases PostgreSQL. La interfaz con mapa se sirvió en `http://localhost:5173`.

| Requisito | Evidencia y resultado |
|---|---|
| Registro, acceso y roles | Registro e inicio de sesión reales; rutas protegidas con 401 sin token y 403 para roles incorrectos. Renovación, cierre de sesión y desactivar/reactivar un usuario comprobados por HTTP. |
| Búsqueda de propiedades | Filtros de zona parcial y sin tildes, tipo, operación, precio, dormitorios y características; orden y dos páginas por el gateway. `%` se trata como texto. Coordenadas presentes. |
| Fotos y detalle | Galería pública; fotos privadas accesibles al agente dueño y 404 público para borradores/pausadas. No se permite quitar la última foto de una publicación. Foto privada visible en el navegador. |
| Favoritos | Guardar, listar y quitar por HTTP con la cuenta del interesado. |
| Crear, editar, publicar y pausar | Propiedad con fotos, características y coordenadas; edición persistida tras recargar y publicación desde el editor del navegador. Pausa 409 con visita futura confirmada; tras cancelarla, pausa 204. |
| Consultas y contactos | Envío, bandeja del agente, respuesta y lectura del cliente por HTTP, con avisos para los destinatarios correspondientes. |
| Visitas | Solicitar, programar, rechazar, cancelar, proponer/contraproponer, aceptar y completar. Completar antes de tiempo devuelve 409; repetir la finalización con la misma clave conserva el resultado. |
| Seguimiento comercial | Listado y registro de notas; cierre de oportunidad como ganada reserva la propiedad por Kafka. Venta y alquiler la retiran del catálogo. |
| Políticas entre servicios | `PropertyPublished` alimenta Visit; reserva rechaza solicitudes pendientes y conserva las programadas; venta cancela la visita futura. Verificadas con `demo.py chains`. |
| Avisos dentro de la app | Comprobados por tipo, propiedad/visita y destinatario: bienvenida, consulta, respuesta, solicitud, programación, rechazo, cancelación, realización, reserva y propuestas de horario. Lectura y filtro de no leídos por HTTP. |
| Fiabilidad de Notification | Reenvío del mismo evento real `VisitCompleted`: un solo aviso y un registro en `processed_events`. Mensaje inválido en `visit.inquiry.events`: llega a su DLQ. Reiniciar Notification conserva el aviso y su fecha de lectura. |
| Gateway, balanceo y discovery | Registro dinámico en Consul; con la caché actualizada, nueve peticiones 200, tres por cada una de las tres réplicas de Listing. Al forzar la caída de una réplica se observó un 504 inicial, después tráfico a las sanas y reincorporación de la recuperada. Se restauró una réplica al terminar. |
| DDD, persistencia, CQRS y patrones | Revisión de capas y dominio sin dependencias de frameworks, PostgreSQL separado por servicio, proyección de catálogo en Listing y snapshot en Visit, outbox y consumidores idempotentes. Patrones documentados en [su catálogo](patrones-de-diseno.md). |

### Pruebas automatizadas y correcciones

- Identity: **362 pruebas aprobadas** con los settings de prueba SQLite; el recorrido integrado de
  registro, acceso y sesión se hizo además contra PostgreSQL real.
- Listing: **160 aprobadas, ninguna omitida**, incluidas las de integración con Testcontainers;
  Checkstyle sin errores (`services/listing-service/mvnw.cmd -B test`).
- Visit: **68 aprobadas, ninguna omitida**, con PostgreSQL y Kafka desechables; lint y formato aprobados
  (`npm run lint` y `npm test`, con `VISIT_TEST_DATABASE_URL` y `VISIT_TEST_KAFKA_BROKER`).
- Notification: `go test ./...` aprobado, incluidas las pruebas de repositorio con PostgreSQL;
  Gateway: `go test ./...` aprobado.
- Interfaz actual (`frontend-lab/`): **283 aprobadas**; build, ESLint y Prettier aprobados
  (`npm test -- --run`, `npm run build`, `npm run lint`).

Se corrigieron tres problemas de verificación: faltaban las coordenadas en el dato de prueba de
`chains`; su comprobación de avisos aceptaba solo la bienvenida y ahora exige nueve avisos concretos;
y el mock de la galería privada usaba un `Blob` de Node incompatible con `FileReader` de jsdom. Visit
también recogía eventos de otras pruebas al verificar su outbox: ahora observa solo el ID de visita
creado por ese caso. `timezone.utc` mantiene la compatibilidad de la demo con Python 3.10.

**Límites de esta evidencia:** para comprobar la finalización sin esperar horas se ajustó únicamente
el horario de una visita creada para la prueba, en su base de Visit. La finalización, los permisos,
el evento y el aviso se ejecutaron por los mecanismos reales. Las pruebas crearon datos de QA.
El 504 aislado al crear un borrador registrado en [progreso de frontend](progreso/frontend.md) sigue
sin causa identificada y no se reprodujo en estos recorridos. El diseño visual y las mejoras
opcionales quedan para una etapa posterior. Estos resultados cubren el alcance obligatorio del
enunciado versionado; los ajustes locales todavía requieren revisión e integración.

### Revalidación al preparar la publicación

La rama se actualizó sobre `origin/main` en `c4fcdbb` (PR #138), conservando las incorporaciones
#131 a #138. El frontend unificado y la CSP configurable de #137 sustituyen el empaquetado local de
`frontend-lab/`; la corrección del test de fotos se trasladó a `frontend/`.

- `frontend/`: **304 pruebas aprobadas**, build y lint aprobados.
- Visit: **69 pruebas aprobadas**, ninguna omitida, con Kafka y PostgreSQL temporales; lint aprobado.
- `docker compose up -d --build` construyó las imágenes nuevas. En esta instalación de Compose
  `v2.38.1-desktop.1` conservó los contenedores anteriores; se aplicaron las imágenes con
  `docker compose up -d --no-build`, manteniendo los volúmenes. Se compararon los IDs de las imágenes
  construidas y ejecutadas para detectar esa diferencia. El arranque desde la raíz reutiliza el
  Compose de infraestructura, sin duplicar la configuración.

Los resultados de Identity y Listing indicados arriba corresponden a la base inicial `6e11b3f`.
