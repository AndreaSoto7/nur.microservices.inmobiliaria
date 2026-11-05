# frontend — React + Vite + TypeScript

Instrucciones para trabajar en el frontend. Complementa al `CLAUDE.md` raíz, que siempre aplica. Todavía no hay código: lo que sigue es el diseño acordado. Si algo no coincide con el código, corrígelo en el mismo PR.

## Ficha

| | |
|---|---|
| Responsable | _(completar)_ |
| Stack | React + Vite + TypeScript estricto ([ADR 0004](../docs/adr/0004-frontend-react.md)) |
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
  core/            cliente HTTP (vía gateway), auth (token, refresh), rutas protegidas, modelos de la API
  shared/ui/       dumbs genéricos: Button, Card, Pagination, EmptyState, ErrorMessage
  features/
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
- **Pendiente de decidir:** router y librería de datos (completar el ADR 0004).
