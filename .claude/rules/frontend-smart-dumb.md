---
paths:
  - "frontend/**"
---

# Frontend — Smart y Dumb Components (arquitectura limpia en el front)

El frontend es **React + Vite + TypeScript** (ver `docs/adr/0004-frontend-react.md`). Las clases explican Smart/Dumb con Angular, pero no es exclusivo de ningún framework: es un principio de arquitectura de interfaces. **Los Smart piensan, los Dumb muestran.** Aplica el principio de responsabilidad única de SOLID a la UI.

## El antipatrón a evitar: el "Componente Dios"

Un componente que hace fetch de datos, maneja estado, contiene lógica de negocio, llama a la API y además renderiza todo. Si un componente hace más de una de esas cosas, divídelo.

## Dumb / presentacional (View)

- Le importa **cómo se ven** las cosas.
- Recibe datos por **props** y avisa de lo que pasa con **callbacks** `onX` (`onFiltersChange`, `onToggleFavorite`). Equivalen a `@Input()` y `@Output()` de Angular.
- **No llama a la API, no usa hooks de datos** (fetch, query, store) **y no conoce rutas** (nada de `useNavigate` ni `useParams`).
- Es un componente puro: con las mismas props, renderiza lo mismo. No modifica sus props. Se puede envolver en `memo` cuando hace falta.
- Puede contener otros componentes dumb.
- Es reutilizable con otra fuente de datos u otro diseño.

## Smart / contenedor (Container)

- Le importa **cómo funcionan** las cosas.
- Obtiene datos a través del **custom hook de su feature** (facade, por ejemplo `useCatalog`) y se los pasa a los dumb por props.
- Lee y escribe el estado de la URL (filtros, paginación) con el router.
- Reacciona a los callbacks de los dumb llamando a las acciones del hook.
- Tiene poco o ningún markup propio: compone dumbs.

## Estructura sugerida

```
frontend/src/
  core/            # cliente HTTP (vía gateway), auth (token, refresh), rutas protegidas, modelos de la API
  shared/ui/       # dumbs genéricos: Button, Card, Pagination, EmptyState, ErrorMessage
  features/
    catalog/
      containers/  CatalogPage.tsx                                         (smart)
      components/  PropertyFilters.tsx  PropertyCard.tsx  PropertyCardList.tsx   (dumb)
      useCatalog.ts                                                        (facade de la feature)
    property-detail/   favorites/   my-visits/
    agent/  properties-admin/  property-form/  visit-requests/  lead-follow-up/
```

## Ejemplos de este proyecto

| Smart (container) | Dumbs que usa |
|---|---|
| `CatalogPage`: lee filtros de la URL y llama a search vía `useCatalog` | `PropertyFilters` (`onFiltersChange`), `PropertyCardList`, `Pagination` |
| `PropertyDetailPage` | `ImageGallery`, `PropertySpecs`, `VisitRequestForm` (`onSubmitRequest`), `FavoriteToggle` |
| `AgentPropertiesPage` | `PropertyTable` (`onPublish`, `onPause`, `onEdit`), `StatusBadge` |
| `VisitRequestsPage` | `VisitRequestList`, `ScheduleVisitDialog` |

## Reglas adicionales

- **Modelos:** los tipos TypeScript de la API reflejan los OpenAPI de `contracts/openapi/`. No inventes campos.
- **Gateway:** toda llamada pasa por el gateway (`import.meta.env.VITE_API_BASE_URL`, `http://localhost:8080` en desarrollo). Nunca se llama a un microservicio directo.
- **Puerto de desarrollo:** 5173, el que Vite usa por defecto y el que permite el CORS del gateway.
- **Estados de UI** explícitos: `loading`, `empty`, `error` y `success`. Los errores problem+json se muestran con su `title` o `detail`.
- **Accesibilidad básica:** labels en inputs, `alt` en imágenes, botones de verdad (no `div` con `onClick`) y `key` estable en las listas.
- **TypeScript estricto** (`strict: true`). Prohibido `any`.
