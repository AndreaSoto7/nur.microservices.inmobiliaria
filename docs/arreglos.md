# Arreglos

Lista de lo que salió de la revisión del proyecto, con lo que ya se hizo y lo que falta. Los cambios
están en la rama `feat/listing-mapa-y-busqueda`, todavía sin commit. Hay que separarlos en PRs por
componente: los contratos primero.

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
- **Elegir la portada** de la galería: hoy es la primera foto que se subió.

## Mejora opcional

- Recomendaciones, comparación de propiedades, agentes favoritos o métricas de visualización.
