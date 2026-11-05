# frontend — React + Vite + TypeScript

Instrucciones para trabajar en el frontend. Complementa al `CLAUDE.md` raíz, que siempre aplica. Ya están la base, el cliente HTTP, la sesión y las pantallas de registro, login y "Mi cuenta"; el resto es el diseño acordado. Si algo no coincide con el código, corrígelo en el mismo PR.

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

No hay notificaciones: el cliente ve el estado de sus solicitudes en "Mis visitas" (ADR 0005). Nunca se llama a un microservicio directo.

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
    api/           httpClient.ts (apiRequest), problem.ts (ApiError a partir del problem+json)
    auth/          tokenStore, session (refresh single-flight), authApi, AuthContext (useAuth), RequireAuth
    models/        tipos que reflejan contracts/openapi (identity.ts, ...)
  shared/ui/       dumbs genéricos: Button, TextField, ErrorMessage, LoadingState (después Card, Pagination, EmptyState)
  test/            setup de Vitest, mocks de fetch y renderApp
  features/
    auth/          LoginPage, RegisterPage (smart) · LoginForm, RegisterForm (dumb) · useAuthActions (facade)
    account/       AccountPage (smart) · ProfileCard (dumb)
    catalog/
      containers/  CatalogPage.tsx                                          (smart)
      components/  PropertyFilters.tsx  PropertyCard.tsx  PropertyCardList.tsx   (dumb)
      useCatalog.ts                                                         (facade)
    property-detail/   favorites/   my-visits/
    agent/  properties-admin/  property-form/  visit-requests/  lead-follow-up/
```

| Smart (container) | Dumbs que usa |
|---|---|
| `CatalogPage`: filtros en la URL, catálogo de listing vía `useCatalog` | `PropertyFilters` (`onFiltersChange`), `PropertyCardList`, `Pagination` |
| `PropertyDetailPage` | `ImageGallery`, `PropertySpecs`, `VisitRequestForm` (`onSubmitRequest`), `FavoriteToggle` |
| `AgentPropertiesPage` | `PropertyTable` (`onPublish`, `onPause`, `onEdit`), `StatusBadge` |
| `VisitRequestsPage` | `VisitRequestList`, `ScheduleVisitDialog` |
| `LeadFollowUpPage` | `LeadTimeline`, `FollowUpForm`, `CloseLeadDialog` (`onClose(outcome)`) |

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
