# frontend — React + Vite + TypeScript

Instrucciones para trabajar en el frontend. Complementa al `CLAUDE.md` raíz, que siempre aplica. Ya están todas las pantallas del enunciado: registro, login, catálogo con mapa, detalle, favoritos, avisos, consultas y visitas del interesado, el panel de agente y la administración de usuarios. Este frontend nació en `frontend-lab/` para probar las skills de diseño (Emil Kowalski, Impeccable y Taste) y reemplazó al anterior. Si algo no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | _(completar)_ |
| Stack | React 19 + Vite 8 + TypeScript 6 estricto, React Router 7, TanStack Query 5 ([ADR 0004](../docs/adr/0004-frontend-react.md)) |
| Puerto | 5173 (el de Vite por defecto y el que permite el CORS del gateway) |
| Backend | Solo el gateway: `import.meta.env.VITE_API_BASE_URL` (`http://localhost:8080` en desarrollo) |
| Contratos | `contracts/openapi/*.yaml` (los tipos de la API los reflejan) |
| Progreso | [`docs/progreso/frontend.md`](../docs/progreso/frontend.md) |

## Qué APIs usa (vía gateway)

| Pantalla | API |
|---|---|
| Registro, login, sesión | identity: `/api/v1/auth/**`, `/api/v1/users/me` |
| Catálogo y detalle públicos | listing: `/api/v1/catalog/properties` (filtros en la URL) |
| Favoritos | listing: `/api/v1/favorites` |
| Avisos | notification: `/api/v1/notifications` (ADR 0007) |
| Mis propiedades, galería (agente) | listing: `/api/v1/properties/**` |
| Consultas, visitas, oportunidades | visit: `/api/v1/inquiries`, `/api/v1/visits`, `/api/v1/leads` |
| Administración de usuarios | identity: `/api/v1/users/**` (solo `ADMIN`) |

Nunca se llama a un microservicio directo.

## Aspecto visual

Paleta, tokens, tipografía, estados de pantalla y accesibilidad: [`docs/convenciones-frontend.md`](../docs/convenciones-frontend.md). Síguelas en toda pantalla nueva.

- Tokens en `src/index.css` (índigo `#1c1b3a`, amarillo `#f2b705`, zona `#b4235c`, fondo `#f5f6f2`) y la piel en `src/skin.css`. Estilos por zona: `catalog.css` (catálogo, mapa, ficha), `editor.css` (asistente de propiedad y galería), `visits.css` (visitas, avisos, diálogos).
- Tipografía Barlow, empaquetada con `@fontsource/barlow` (sin fuentes externas: la CSP no las permite).
- El contexto de diseño (para quién es, qué evitar) está en `PRODUCT.md`. Las skills de diseño del repo (`emil-design-eng`, `impeccable`, `design-taste-frontend`) lo leen.
- Hover solo con `@media (hover: hover)`: en el celular, un toque dejaba el botón resaltado.

## Smart y Dumb components

**Los Smart piensan, los Dumb muestran.** Es el principio de responsabilidad única aplicado a la UI. El antipatrón a evitar es el **"componente Dios"**: fetch, estado, lógica de negocio, llamadas a la API y render en un solo componente.

**Dumb / presentacional:**
- Le importa **cómo se ven** las cosas. Recibe datos por **props** y avisa con **callbacks** `onX` (`onFiltersChange`, `onToggleFavorite`).
- **No llama a la API, no usa hooks de datos** (fetch, query, store) **ni conoce rutas** (`useNavigate`, `useParams`).
- Es puro: mismas props, mismo render; no modifica sus props. `memo` cuando hace falta. Reutilizable con otra fuente de datos.

**Smart / contenedor:**
- Le importa **cómo funcionan** las cosas. Obtiene datos del **custom hook de su feature** (facade, por ejemplo `useCatalog`) y los pasa por props.
- Lee y escribe el estado de la URL (filtros, paginación). Reacciona a los callbacks llamando a las acciones del hook.
- Tiene poco o ningún markup propio: compone dumbs.

## Estructura

```
frontend/src/
  app/             raíz de composición: App.tsx (rutas), AppLayout (smart), components/AppHeader y UserMenu (dumb)
  core/            cliente HTTP (vía gateway), auth (token, refresh), rutas protegidas, modelos de la API
    api/           httpClient.ts (apiRequest; admite headers propios y FormData), problem.ts (ApiError a partir del problem+json), catalogApi.ts, propertiesApi.ts, favoritesApi.ts, notificationsApi.ts, visitsApi.ts, inquiriesApi.ts, leadsApi.ts, idempotency.ts
    auth/          tokenStore, session (refresh single-flight), authApi, AuthContext (useAuth), RequireAuth
    models/        tipos que reflejan contracts/openapi (identity.ts, listing.ts, notification.ts, visit.ts)
  shared/format/   fechas en hora local, formato de precio (Bs, / mes en alquiler), teléfono y etiquetas en español de tipos, operaciones, estados y extras
  shared/map/      mapConfig.ts: mosaicos de OpenStreetMap (VITE_MAP_TILE_URL), centro de Santa Cruz y alfiler
  shared/ui/       dumbs genéricos: Button, TextField, SelectField, TextAreaField, FilterSelect, StatusBadge, Dialog (<dialog> modal), ContactLine, RowListSkeleton, ErrorMessage, LoadingState, Pagination, EmptyState, icons
  test/            setup de Vitest, mocks de fetch y renderApp
  features/
    auth/          LoginPage, RegisterPage (smart) · LoginForm, RegisterForm (dumb) · useAuthActions (facade)
    catalog/
      containers/  CatalogPage.tsx                                          (smart)
      components/  PropertyFilters  SortSelect  ZoneChips  PropertyRow  PropertyRowList  CatalogMap  PropertyRowsSkeleton   (dumb)
      useCatalog.ts                                                         (facade)
      catalogFilters.ts   filtros ↔ URL ↔ query del contrato (funciones puras, con tests)
    property-detail/
      containers/  PropertyDetailPage  PropertyContactSection   (smart) · components/ ImageGallery  PropertySpecs  PropertyDescription  LocationMap  VisitRequestForm  InquiryForm   (dumb)
      usePropertyDetail.ts (facade; un 404 es "ya no está disponible", no un error)
      usePropertyContact.ts (facade de solicitar visita y enviar consulta)
    agent/
      AgentLayout.tsx   menú común del panel de agente (smart)
      usePropertyTitles.ts   título de cada propiedad, que las consultas y las oportunidades no traen
      properties-admin/
        containers/  AgentPropertiesPage.tsx (smart)
        components/  PropertyAdminList  PropertyActions  PropertyStatusBadge   (dumb)
        useAgentProperties.ts (facade; estado y página en la URL) · usePropertyTransition.ts (facade)
        propertyActions.ts    qué transiciones ofrecer según el estado (función pura, con tests)
      property-form/
        containers/  PropertyCreatePage  PropertyEditPage  PropertyWizard  PropertyStatusSection  PropertyImagesSection   (smart)
        components/  WizardSteps  BasicsFields  LocationFields  LocationPicker  DetailsFields  PropertyImagesForm  ReviewSummary  WizardPreview  PublishChecklist   (dumb)
        usePropertyWizard.ts (facade del asistente) · usePropertyForm.ts (carga, fotos) · propertyFormValues.ts (formulario ↔ request del contrato) · propertyWizard.ts (pasos, con tests)
        propertyRequirements.ts   qué falta para publicar y validación de fotos (funciones puras, con tests)
      visit-requests/
        containers/  AgentVisitsPage   (smart) · components/ AgentVisitRow  AgentAgenda  TimeProposalForm  VisitOutcomeDialog   (dumb)
        useAgentVisits.ts (facade, con la agenda) · useVisitOutcome.ts (marcar realizada y cerrar o anotar la oportunidad) · visitActions.ts (choques, agenda y cuándo se puede marcar realizada, con tests)
      inquiries/
        containers/  AgentInquiriesPage  InquiryDetailSection   (smart) · components/ InquiryRow  InquiryContent   (dumb)
        useAgentInquiries.ts (facade)
      lead-follow-up/
        containers/  AgentLeadsPage   (smart) · components/ LeadRow  CloseLeadForm   (dumb)
        useAgentLeads.ts (facade)
    favorites/
      containers/  FavoritesPage  FavoriteControl   (smart) · components/ FavoriteList  FavoriteToggle   (dumb)
      useFavorites.ts   (facade de la página y del botón)
    notifications/
      containers/  NotificationsPage  NotificationsNavLink  NotificationToaster   (smart) · components/ NotificationList  NotificationToast   (dumb)
      useNotifications.ts   (facade de la página, del contador y de los últimos sin leer) · notificationToast.ts (qué anunciar, con tests)
    admin/
      containers/  AdminUsersPage   (smart) · components/ AdminUserRow  RolesForm   (dumb)
      useAdminUsers.ts (facade; rol y página en la URL)
    my-visits/
      containers/  MyVisitsPage   (smart) · components/ MyVisitRow  VisitDetails  ReasonPanel   (dumb)
      useMyVisits.ts (facade)
```

| Smart (container) | Dumbs que usa |
|---|---|
| `CatalogPage`: filtros en la URL, catálogo de listing vía `useCatalog` | `PropertyFilters` (`onFiltersChange`), `ZoneChips`, `SortSelect` (`onSortChange`), `PropertyRowList`, `CatalogMap` (`onActivate`, `onSelect`), `Pagination` |
| `PropertyDetailPage` | `ImageGallery`, `PropertySpecs`, `FavoriteControl`, `PropertyContactSection` |
| `PropertyContactSection` | `VisitRequestForm` (`onSubmitRequest`), `InquiryForm` (`onSubmitInquiry`) |
| `NotificationsPage` | `NotificationList` (`onMarkRead`, `onRemove`), `Pagination` |
| `NotificationToaster` | `NotificationToast` (`onClose`, `onHold`) |
| `AdminUsersPage` | `AdminUserRow` (`onAssignRoles`, `onDeactivate`, `onActivate`), `RolesForm`, `FilterSelect`, `Pagination` |
| `MyVisitsPage` | `MyVisitRow` (`onCancel`, `onAccept`, `onPropose`), `VisitDetails`, `ReasonPanel`, `TimeProposalForm`, `FilterSelect`, `Pagination` |
| `FavoritesPage`, `FavoriteControl` | `FavoriteList` (`onRemove`), `FavoriteToggle` (`onToggle`), `Pagination` |
| `AgentPropertiesPage` | `PropertyAdminList` (`onTransition`), `PropertyActions` (`onRun`), `PropertyStatusBadge`, `FilterSelect` (`onChange`) |
| `PropertyWizard` (en `PropertyCreatePage` y `PropertyEditPage`) | `WizardSteps` (`onSelect`), `BasicsFields`, `LocationFields`, `DetailsFields` (`onChange`), `PropertyImagesForm` (`onUpload`, `onRemove`, `onMove`), `ReviewSummary`, `WizardPreview`, `PublishChecklist`, `PropertyActions` |
| `AgentVisitsPage` | `AgentAgenda`, `AgentVisitRow` (`onAccept`, `onPropose`, `onReject`, `onCancel`, `onComplete`), `VisitOutcomeDialog` (`onSubmit`), `TimeProposalForm`, `ContactLine`, `ReasonPanel`, `VisitDetails` |
| `AgentInquiriesPage` | `InquiryRow` (`onToggle`), `InquiryDetailSection`, `InquiryContent` |
| `AgentLeadsPage` | `LeadRow` (`onAddNote`, `onClose`), `CloseLeadForm` (`onClose(outcome, note)`), `ReasonPanel` |

## Catálogo

- Ruta `/` (pública). Los filtros viven en la URL (`?zone=…&operation=RENT&features=POOL,GARAGE&page=2`): se comparten, se recargan y funcionan con atrás/adelante. Lo inválido se descarta (`catalogFilters.ts`).
- `PropertyFilters`: lo que se elige (operación, tipo, dormitorios, características) se aplica al momento; lo que se escribe (zona, precios) espera a "Buscar" o Enter. Si la URL cambia desde afuera (atajos de zona, limpiar, orden), el borrador vuelve a la URL. Filtrar vuelve a la página 1.
- **Mapa:** `CatalogMap` (Leaflet + react-leaflet) muestra el precio de cada propiedad como marcador y encuadra los resultados. Al pasar por una fila se ilumina su precio. En el celular, "Ver mapa" lo abre a pantalla completa. Las propiedades sin coordenadas no aparecen y la lista lo avisa.
- **Zona:** listing busca por parte del nombre, sin tildes ni mayúsculas (`uru` encuentra Urubó). `ZoneChips` ofrece las zonas de los resultados.
- `keepPreviousData`: al cambiar de página se sigue viendo la anterior hasta que llega la nueva.
- Las rutas de imágenes vienen relativas al gateway: `gatewayUrl()` de `core/config.ts` las vuelve absolutas. Si una foto no carga, la tarjeta muestra "Sin foto".
- Detalle en `/properties/:propertyId` (`GET /api/v1/catalog/properties/{id}`): solo `PUBLISHED` o `RESERVED`; un 404 se muestra como "no disponible" y no se reintenta. La galería y los datos, descripción ampliable y mapa ocupan la columna principal; precio y contacto se agrupan en la lateral. En celular: galería, precio/contacto y datos completos. La galería tiene flechas y se desliza en el celular. "Solicitar una visita" y "Enviar una consulta" comparten `name` en `<details>`: abrir uno cierra el otro. Con un formulario abierto el contacto deja de ser fijo.

## Mis propiedades (agente)

- Rutas `/agent/properties`, `/agent/properties/new` y `/agent/properties/:propertyId`, solo con rol `AGENT`. El filtro de estado y la página viven en la URL.
- `availableActions` solo evita ofrecer acciones imposibles: las reglas las hace cumplir listing, y sus 409 se muestran con su `detail`. Vender y alquilar son irreversibles, por eso piden confirmación.
- **Asistente en pasos** (`PropertyWizard`): Datos, Ubicación, Detalles, Fotos y Publicar; el paso vive en la URL (`?paso=`). Lo escrito no se pierde al volver atrás. Al crear, el borrador se crea al terminar los detalles (las fotos necesitan que exista); si falla lo que sigue, reintentar no crea otro. Al editar, salir de un paso con cambios los guarda. Un error de la API lleva al paso de ese campo. A la derecha, `WizardPreview` muestra cómo se ve en el catálogo.
- El tipo y la operación no se editan (contrato). El `PUT` reemplaza la ubicación completa: zona, dirección y coordenadas salen del formulario. La ubicación se marca tocando el mapa, arrastrando el alfiler o escribiendo las coordenadas.
- Publicar exige dormitorios, baños, superficie y al menos una foto: `PublishChecklist` lo explica y el botón queda desactivado hasta completarlo.
- **Fotos:** las de un borrador o una propiedad pausada solo las ve su agente: se piden con el token y se muestran como `data:` URL (la CSP no admite `blob:`). Las elegidas se ven antes de subirlas, cada una con su problema si lo tiene. Se pueden quitar y ordenar (flechas y "Hacer portada"); la primera es la portada del catálogo. El front revisa formato, tamaño y cantidad, pero la firma real la valida listing.
- `POST /properties` no es idempotente: ante un 504 se avisa que el borrador pudo crearse, para que no se duplique al reintentar.

## Solicitudes de visita (agente)

- Ruta `/agent/visit-requests`, dentro del panel de agente (`AgentLayout`). `/agent` lleva a sus propiedades. Todas las rutas del panel exigen rol `AGENT`.
- Arriba, `AgentAgenda` muestra las próximas visitas programadas. Cada solicitud avisa si choca con una de ellas o si el horario ya pasó, y en esos casos no deja aceptarla (visit igual rechaza un choque). Aceptar programa en el horario pedido; "Proponer otro horario" se lo manda al interesado, que acepta o contrapropone. Mientras espera su respuesta, la fila lo dice.
- Cada fila muestra a quién contactar (`ContactLine`: nombre, email y teléfono con `mailto:` y `tel:`). El título lleva a la ficha pública, no al editor.
- "Marcar realizada" solo aparece cuando terminó el horario: antes, visit responde `VISIT_COMPLETION_TOO_EARLY`. Abre un diálogo con una nota y cómo quedó el interesado: sigue interesado (nota en su oportunidad), cierra el trato (la gana y reserva la propiedad) o no le interesó (la pierde).
- El error de una acción se muestra en su fila y el formulario sigue abierto, para corregir sin volver a escribir.

## Consultas y oportunidades (agente)

- Rutas `/agent/inquiries` y `/agent/leads`. El mensaje de una consulta se pide recién al abrirla.
- Cerrar una oportunidad como ganada dispara `LeadClosed`, y listing reserva la propiedad al recibirlo. La pantalla dice que queda reservada "en unos instantes" y no asume el cambio.
- El agente responde cada consulta una vez; el interesado la ve en "Mis consultas". "Ver notas" muestra el seguimiento de una oportunidad. Cada oportunidad muestra a quién contactar (`client` de visit: lo último que el interesado le dio a ese agente).

## Favoritos

- Ruta `/favorites`, para `CLIENT` o `AGENT`. La página vive en la URL.
- El contrato no dice si una propiedad es favorita: se deriva de `GET /favorites` con `size=100`, el máximo. Con más de 100 favoritos, el botón del detalle podría ofrecer guardar una que ya está guardada.
- `FAVORITE_ALREADY_EXISTS` y `FAVORITE_NOT_FOUND` no se muestran como error: lo que se pedía ya es cierto, por ejemplo por un cambio en otra pestaña.
- Solo se guarda una propiedad `PUBLISHED`, pero se puede quitar en cualquier estado. Si ya no es visible, la lista avisa "Ya no está disponible".

## Administración de usuarios

- Ruta `/admin/users`, solo con rol `ADMIN`. El filtro de rol y la página viven en la URL.
- Sobre la propia cuenta no se ofrece desactivar ni quitarse el rol de administrador. Es comodidad de UI: la regla la hace cumplir identity (`USER_OWN_ACCOUNT_PROTECTED`).
- La `key` de cada fila incluye roles y estado: al guardar, la fila se reinicia y el panel se cierra. Si falla, el panel sigue abierto para corregir.
- Los cambios llegan a los demás servicios cuando la persona renueva su token, en 15 minutos como máximo, y la pantalla lo avisa.

## Cabecera

- A la vista: Inicio, la sección principal de cada rol y la campanita de avisos. El menú con el nombre del usuario muestra arriba el nombre y el email, y lleva a Mis consultas, Favoritos y Cerrar sesión (no hay página "Mi cuenta").
- El menú es un botón con `aria-expanded` que despliega enlaces. Se cierra al elegir una opción, con Escape (el foco vuelve al botón) y al hacer clic afuera.
- El primer enlace permite saltar al contenido con el teclado. En las páginas privadas del cliente,
  `AccountNavigation` hace visibles visitas, consultas, favoritos y avisos, conservando el menú.

## Presentación y portadas del agente

- `management.css` unifica navegación, encabezados, registros y acciones de las pantallas privadas.
  Las decisiones visuales están en [DESIGN.md](DESIGN.md).
- «Mis propiedades» muestra `coverImageUrl` del resumen. `usePropertyCovers` solo descarga con token
  las portadas privadas de la página actual, sin consultar el detalle por cada propiedad. La conversión
  a `data:` se comparte con el editor en `shared/images/imageDataUrl.ts`.
- `PropertyCover` conserva espacio mientras carga y muestra «Sin foto» si falta o falla la imagen.
  Editar/completar es explícito y las transiciones existentes siguen disponibles y con confirmación.

## Avisos

- Ruta `/notifications`, para cualquier usuario con sesión. El filtro "Solo sin leer" y la página viven en la URL.
- `type` es `string` y no un enum: el contrato pide tolerar tipos nuevos, y el texto ya viene en `message`.
- `notificationLink` decide a qué pantalla lleva cada aviso según su tipo. Con un tipo desconocido lleva a la ficha pública de la propiedad, o a ningún lado si no hay propiedad.
- Los últimos sin leer se vuelven a pedir cada 30 s (`useLatestUnread`), porque los avisos nacen de eventos y nadie le avisa al navegador. Una sola request sirve al contador y al anuncio. Se monta solo con sesión. Si notification no responde, el enlace sigue ahí sin número.
- **Anuncio de avisos nuevos:** `NotificationToaster` muestra un mensaje que baja desde arriba con un título según el tipo ("Tienes una nueva consulta") y un botón para ir a verlo; se va solo a los 6 s, salvo con el puntero encima. Hasta qué aviso ya se anunció se guarda por usuario en `localStorage`: al recargar no se repite. En `/notifications` no anuncia nada.
- Cada aviso se puede borrar; el evento que lo creó no lo vuelve a crear.

## Consultas y visitas (interesado)

- Se envían desde el detalle, solo con rol `CLIENT` y si la propiedad está `PUBLISHED`. Sin sesión, un enlace lleva a ingresar y vuelve a la misma ficha.
- **`Idempotency-Key` obligatorio en los POST de visit:** `useIdempotencyKey` reutiliza la clave si se reintenta lo mismo, para que un corte de red no duplique la solicitud, y usa otra si cambió el contenido, porque el servicio responde 422. `crypto.randomUUID` no existe fuera de HTTPS o localhost: `newIdempotencyKey` tiene alternativa para cuando se abre por la IP de la red local.
- El `datetime-local` da hora local: se manda en UTC con `localInputToUtc`.
- La solicitud de visita pide un teléfono opcional, para que el agente pueda llamar (mismas reglas que la consulta).
- **Mis visitas** (`/my-visits`, solo `CLIENT`): el estado y la página viven en la URL. Si el agente propuso otro horario, el interesado lo acepta o propone otro. Una visita solo se cancela si está `SCHEDULED`. El título viene en la visita (`propertyTitle`, de la copia local de visit), así que se ve aunque la propiedad ya no esté publicada. Si falta, muestra "Propiedad no disponible".
- **Motivos:** las políticas de visit dejan `PROPERTY_RESERVED` o `PROPERTY_UNAVAILABLE` como motivo. `visitReasonLabel` los pasa a español; el motivo que escribe una persona se muestra tal cual.

## Sesión y tokens

- **Access token** (15 min), solo en memoria. **Refresh token**, en `localStorage` (`core/auth/tokenStore.ts`). Tiene que ser compartido entre pestañas: identity no da período de gracia, y con copias por pestaña la segunda reutilizaría un token ya canjeado y se revocaría la sesión. identity lo entrega en el body, sin cookie httpOnly, así que un XSS podría leerlo: lo mitiga la CSP de `nginx/security-headers.inc.template` (sin scripts inline ni de terceros, y `connect-src` solo hacia el gateway).
- Una llamada con `auth: true` que responde 401 renueva la sesión **una vez** y se repite (`core/auth/session.ts`). El canje se serializa como pide el contrato: *single-flight* en la pestaña y un Web Lock entre pestañas, que relee el token adentro.
- **Solo un 401 del refresh cierra la sesión.** Con 5xx, 429 o sin red se conserva para reintentar. Si se cierra la sesión mientras hay un canje en curso, el par nuevo se revoca y no revive la sesión.
- Cerrar sesión en una pestaña la cierra en las demás (evento `storage`) y borra la caché de React Query.
- Al cargar la página, `AuthProvider` intenta recuperar la sesión con el refresh token. Si identity lo rechaza, el usuario queda anónimo.
- `RequireAuth` es comodidad de UI: la autorización real la hace cada servicio con el JWT.

## Docker (nginx)

- `Dockerfile` multi-stage: Node compila con `VITE_API_BASE_URL` (build arg) y `nginxinc/nginx-unprivileged` sirve `dist/` sin root, en el puerto 8080 del contenedor (5173 en el host).
- `nginx/default.conf.template`: las rutas del router devuelven `index.html` (`no-cache`); `/assets/` con hash se cachea un año; `/healthz` para el `HEALTHCHECK`.
- `nginx/security-headers.inc.template`: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Se incluye en cada `location` porque un `add_header` local anula los heredados.
- `API_ORIGIN` (variable del contenedor, la reemplaza envsubst al arrancar) tiene que ser el mismo origen que `VITE_API_BASE_URL`: si no, la CSP bloquea las llamadas al gateway.
- `MAP_TILE_ORIGIN` (por defecto `https://tile.openstreetmap.org`) entra en `img-src`: sin él, el mapa queda gris. Si se cambia `VITE_MAP_TILE_URL`, hay que cambiar este origen.
- Si se agrega un estilo inline, una fuente externa o un script de terceros, hay que ajustar la CSP en el mismo PR.

## Reglas

- **Modelos:** los tipos TypeScript reflejan los OpenAPI de `contracts/openapi/`. No inventes campos.
- **Estados de UI** explícitos: `loading`, `empty`, `error` y `success`. Los errores problem+json se muestran con su `title` o `detail`.
- **Consistencia eventual:** después de cerrar una oportunidad como ganada, la propiedad pasa a reservada unos instantes después (la reserva la hace listing al recibir el evento). La UI no debe asumir el cambio inmediato.
- **Accesibilidad básica:** labels en inputs, `alt` en imágenes, botones reales (no `div` con `onClick`), `key` estable en listas.
- **TypeScript estricto** (`strict: true`). Prohibido `any`.

## Comandos

```bash
npm ci
npm run dev        # puerto 5173
npm run test       # Vitest + React Testing Library
npm run lint       # ESLint + Prettier
npm run build
```

## Qué usar al trabajar aquí

- **Rules que se cargan solas:** `testing`, `patrones-diseno` (Facade, Smart/Dumb), `principios-solid`, `seguridad`.
- **Skills:** `/componente-front` para cada pantalla, `/revisar`, `/crear-pr`.
- **Agente revisor:** ninguno por defecto: `/revisar` tiene el checklist de frontend. `revisor-seguridad` si se toca el manejo de tokens.
- **Librerías:** React Router 7 y TanStack Query 5, decididas en el ADR 0004. Mapas con Leaflet 1.9 y react-leaflet 5.
- **Skills de diseño:** `frontend-ui-engineering` (encadena `emil-design-eng`, `impeccable` y `design-taste-frontend`) y revisar en Chrome a 1440 y 390 px.
