# frontend — React + Vite + TypeScript

Instrucciones para trabajar en el frontend. Complementa al `CLAUDE.md` raíz, que siempre aplica. Ya están la base, el cliente HTTP, la sesión, registro, login, "Mi cuenta", el catálogo público, el detalle de propiedad, "Mis propiedades" del agente y favoritos; el resto es el diseño acordado. Si algo no coincide con el código, corrígelo en el mismo PR.

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
| Mis propiedades, galería (agente) | listing: `/api/v1/properties/**` |
| Consultas, visitas, oportunidades | visit: `/api/v1/inquiries`, `/api/v1/visits`, `/api/v1/leads` |

Las notificaciones tienen API (`/api/v1/notifications`, ADR 0007), pero todavía no tienen pantalla. Nunca se llama a un microservicio directo.

## Aspecto visual

Paleta, tokens, tipografía, estados de pantalla y accesibilidad: [`docs/convenciones-frontend.md`](../docs/convenciones-frontend.md). Síguelas en toda pantalla nueva.

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
  app/             raíz de composición: App.tsx (rutas), AppLayout (smart), components/AppHeader (dumb)
  core/            cliente HTTP (vía gateway), auth (token, refresh), rutas protegidas, modelos de la API
    api/           httpClient.ts (apiRequest; admite headers propios y FormData), problem.ts (ApiError a partir del problem+json), catalogApi.ts, propertiesApi.ts, favoritesApi.ts
    auth/          tokenStore, session (refresh single-flight), authApi, AuthContext (useAuth), RequireAuth
    models/        tipos que reflejan contracts/openapi (identity.ts, listing.ts)
  shared/format/   formato de precio (Bs, / mes en alquiler) y etiquetas en español de tipos, operaciones, estados y extras
  shared/ui/       dumbs genéricos: Button, TextField, SelectField, TextAreaField, StatusBadge, RowListSkeleton, ErrorMessage, LoadingState, Pagination, EmptyState, icons
  test/            setup de Vitest, mocks de fetch y renderApp
  features/
    auth/          LoginPage, RegisterPage (smart) · LoginForm, RegisterForm (dumb) · useAuthActions (facade)
    account/       AccountPage (smart) · ProfileCard (dumb)
    catalog/
      containers/  CatalogPage.tsx                                          (smart)
      components/  PropertyFilters  SortSelect  PropertyCard  PropertyCardList  PropertyGridSkeleton   (dumb)
      useCatalog.ts                                                         (facade)
      catalogFilters.ts   filtros ↔ URL ↔ query del contrato (funciones puras, con tests)
    property-detail/
      containers/  PropertyDetailPage.tsx (smart) · components/ ImageGallery, PropertySpecs (dumb)
      usePropertyDetail.ts (facade; un 404 es "ya no está disponible", no un error)
    agent/
      properties-admin/
        containers/  AgentPropertiesPage.tsx (smart)
        components/  PropertyAdminList  PropertyActions  PropertyStatusBadge  StatusFilter   (dumb)
        useAgentProperties.ts (facade; estado y página en la URL) · usePropertyTransition.ts (facade)
        propertyActions.ts    qué transiciones ofrecer según el estado (función pura, con tests)
      property-form/
        containers/  PropertyCreatePage  PropertyEditPage  PropertyStatusSection  PropertyFeaturesSection  PropertyImagesSection   (smart)
        components/  PropertyDataForm  PropertyFeaturesForm  PropertyImagesForm  PublishChecklist   (dumb)
        usePropertyForm.ts (facade) · propertyFormValues.ts (formulario ↔ request del contrato)
        propertyRequirements.ts   qué falta para publicar y validación de fotos (funciones puras, con tests)
      visit-requests/  lead-follow-up/
    favorites/
      containers/  FavoritesPage  FavoriteControl   (smart) · components/ FavoriteList  FavoriteToggle   (dumb)
      useFavorites.ts   (facade de la página y del botón)
    my-visits/
```

| Smart (container) | Dumbs que usa |
|---|---|
| `CatalogPage`: filtros en la URL, catálogo de listing vía `useCatalog` | `PropertyFilters` (`onFiltersChange`), `SortSelect` (`onSortChange`), `PropertyCardList`, `PropertyGridSkeleton`, `Pagination` |
| `PropertyDetailPage` | `ImageGallery`, `PropertySpecs`, `FavoriteControl`, `VisitRequestForm` (`onSubmitRequest`) |
| `FavoritesPage`, `FavoriteControl` | `FavoriteList` (`onRemove`), `FavoriteToggle` (`onToggle`), `Pagination` |
| `AgentPropertiesPage` | `PropertyAdminList` (`onTransition`), `PropertyActions` (`onRun`), `PropertyStatusBadge`, `StatusFilter` (`onStatusChange`) |
| `PropertyCreatePage`, `PropertyEditPage` | `PropertyDataForm` (`onSubmit`), `PropertyFeaturesForm` (`onSubmit`), `PropertyImagesForm` (`onUpload`), `PublishChecklist`, `PropertyActions` |
| `VisitRequestsPage` | `VisitRequestList`, `ScheduleVisitDialog` |
| `LeadFollowUpPage` | `LeadTimeline`, `FollowUpForm`, `CloseLeadDialog` (`onClose(outcome)`) |

## Catálogo

- Ruta `/` (pública). Los filtros viven en la URL (`?zone=…&operation=RENT&features=POOL,GARAGE&page=2`): se comparten, se recargan y funcionan con atrás/adelante. Lo inválido se descarta (`catalogFilters.ts`).
- `PropertyFilters` edita un borrador y avisa al buscar; el container le pasa `key={filtersKey}` para reiniciarlo cuando cambia la URL. Buscar vuelve a la página 1. El orden está junto a los resultados y aplica al momento, sin pasar por el borrador.
- `keepPreviousData`: al cambiar de página se sigue viendo la anterior hasta que llega la nueva.
- Las rutas de imágenes vienen relativas al gateway: `gatewayUrl()` de `core/config.ts` las vuelve absolutas. Si una foto no carga, la tarjeta muestra "Sin foto".
- Detalle en `/propiedades/:propertyId` (`GET /api/v1/catalog/properties/{id}`): solo `PUBLISHED` o `RESERVED`; un 404 se muestra como "no disponible" y no se reintenta.

## Mis propiedades (agente)

- Rutas `/agente/propiedades`, `/agente/propiedades/nueva` y `/agente/propiedades/:propertyId`, solo con rol `AGENT`. El filtro de estado y la página viven en la URL.
- `availableActions` solo evita ofrecer acciones imposibles: las reglas las hace cumplir listing, y sus 409 se muestran con su `detail`. Vender y alquilar son irreversibles, por eso piden confirmación.
- El tipo y la operación no se editan (contrato). El `PUT` reemplaza la ubicación completa: al guardar se conservan la latitud y la longitud, aunque el formulario no las muestre.
- Publicar exige dormitorios, baños, superficie y al menos una foto: `PublishChecklist` lo explica y el botón queda desactivado hasta completarlo.
- **Fotos:** `GET .../images/{id}` es público y responde 404 si la propiedad está en `DRAFT` o `PAUSED`, así que ahí solo se muestra la cantidad, sin miniaturas. La vista previa local tampoco se usa: la CSP bloquea `blob:`. El front revisa formato, tamaño y cantidad antes de subir, pero la firma real la valida listing.
- `POST /properties` no es idempotente: ante un 504 se avisa que el borrador pudo crearse, para que no se duplique al reintentar.

## Favoritos

- Ruta `/favoritos`, para `CLIENT` o `AGENT`. La página vive en la URL.
- El contrato no dice si una propiedad es favorita: se deriva de `GET /favorites` con `size=100`, el máximo. Con más de 100 favoritos, el botón del detalle podría ofrecer guardar una que ya está guardada.
- `FAVORITE_ALREADY_EXISTS` y `FAVORITE_NOT_FOUND` no se muestran como error: lo que se pedía ya es cierto, por ejemplo por un cambio en otra pestaña.
- Solo se guarda una propiedad `PUBLISHED`, pero se puede quitar en cualquier estado. Si ya no es visible, la lista avisa "Ya no está disponible".

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
- **Librerías:** React Router 7 y TanStack Query 5, decididas en el ADR 0004.
