---
paths:
  - "frontend/**"
---

# Frontend — Smart y Dumb Components (arquitectura limpia en el front)

No es exclusivo de Angular: es un principio de arquitectura de interfaces. **Los Smart piensan, los Dumb muestran.** Aplica el principio de responsabilidad única de SOLID a la UI.

## El antipatrón a evitar: el "Componente Dios"

Un componente que hace fetch de datos, maneja estado, contiene lógica de negocio, llama a la API y además renderiza todo. Si un componente hace más de una de esas cosas, divídelo.

## Dumb / presentacional (View)

- Le importa **cómo se ven** las cosas.
- Recibe datos por inputs (`@Input()` / `input()` en Angular, props en React) y emite eventos por outputs (`@Output()` / `output()`, callbacks `onX` en React).
- **No inyecta servicios de datos**, no llama a la API ni al store, y no conoce rutas.
- Angular: `changeDetection: ChangeDetectionStrategy.OnPush`. React: componente puro, memoizable.
- Puede contener otros componentes dumb.
- Es reutilizable con otra fuente de datos u otro diseño.

## Smart / contenedor (Container)

- Le importa **cómo funcionan** las cosas.
- Obtiene datos (servicios, facade o store: NgRx/Signals en Angular, hooks o store en React) y se los pasa a los dumb.
- Reacciona a los eventos de los dumb llamando a acciones del estado, servicios o comandos.
- Tiene poco o ningún markup propio: compone dumbs.

## Estructura sugerida

```
frontend/src/app/
  core/            # api clients (uno por microservicio vía gateway), auth interceptor, guards, modelos de la API
  shared/ui/       # dumbs genéricos: button, card, pagination, empty-state
  features/
    catalog/
      containers/  catalog-page/            (smart)
      components/  property-filters/  property-card/  property-card-list/   (dumb)
      catalog.facade.ts
    property-detail/   favorites/   my-visits/
    agent/  properties-admin/  property-form/  visit-requests/  lead-follow-up/
```

## Ejemplos de este proyecto

| Smart (container) | Dumbs que usa |
|---|---|
| `CatalogPageComponent`: lee filtros de la URL y llama a search | `PropertyFiltersComponent` (emite `filtersChange`), `PropertyCardListComponent`, `PaginationComponent` |
| `PropertyDetailPageComponent` | `ImageGalleryComponent`, `PropertySpecsComponent`, `VisitRequestFormComponent` (emite `submitRequest`), `FavoriteToggleComponent` |
| `AgentPropertiesPageComponent` | `PropertyTableComponent` (emite `publish`, `pause`, `edit`), `StatusBadgeComponent` |
| `VisitRequestsPageComponent` | `VisitRequestListComponent`, `ScheduleVisitDialogComponent` |

## Reglas adicionales

- Los modelos TypeScript de la API reflejan los OpenAPI de `contracts/openapi/`. No inventes campos.
- Toda llamada pasa por el gateway (`environment.apiBaseUrl`). Nunca se llama a un microservicio directo.
- Los estados de UI son explícitos: `loading`, `empty`, `error` y `success`. Los errores problem+json se muestran con su `title` o `detail`.
- Accesibilidad básica: labels en inputs, `alt` en imágenes, botones de verdad (no `div` con click).
