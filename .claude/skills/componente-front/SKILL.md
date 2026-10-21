---
name: componente-front
description: Crea o refactoriza componentes React del frontend aplicando el patrón Smart/Dumb (contenedor y presentacional). Úsala al construir pantallas como el catálogo, el detalle de propiedad, favoritos, mis visitas o el panel del agente, o al partir un "componente Dios".
argument-hint: "[pantalla o componente]"
---

# Componentes Smart / Dumb

Pantalla o componente: $ARGUMENTS

Sigue `.claude/rules/frontend-smart-dumb.md`. El frontend es React + Vite + TypeScript (`docs/adr/0004-frontend-react.md`). Revisa en ese ADR qué librerías de router y de datos eligió el equipo.

## 1. Descomponer antes de programar

Dibuja el árbol de componentes y márcalo así:

```
CatalogPage (SMART)  ← useCatalog (facade): search API vía gateway, filtros en la URL
├── PropertyFilters (DUMB)    props: filters, zones   callbacks: onFiltersChange
├── PropertyCardList (DUMB)   props: properties       callbacks: onSelect, onToggleFavorite
│   └── PropertyCard (DUMB)   props: property         callbacks: onSelect, onToggleFavorite
└── Pagination (DUMB)         props: page             callbacks: onPageChange
```

Para cada dumb, define sus **props** y **callbacks**. Para el smart, define qué hook usa para obtener los datos y qué acción ejecuta ante cada callback.

## 2. Implementar

**Dumb:**
- Solo props y callbacks. Sin hooks de datos, sin router, sin store.
- Componente puro: no modifica sus props. Envuélvelo en `memo` si se renderiza en listas grandes.
- Maneja sus estados visuales a partir de las props: vacío, deshabilitado.

**Smart:**
- Usa el custom hook de la feature (`useCatalog`, `useMyVisits`) como facade. Pasa los datos hacia abajo y traduce los callbacks en acciones.
- Maneja `loading`, `error` (problem+json) y `empty`.

**Modelos:**
- Los tipos TypeScript coinciden con `contracts/openapi/`.
- Las llamadas HTTP solo en `core/`, siempre vía gateway (`VITE_API_BASE_URL`).

## 3. Tests

Con Vitest + React Testing Library:

- **Dumb:** renderiza según las props y llama al callback correcto ante la interacción (`userEvent`).
- **Smart:** con el hook o el cliente HTTP mockeado, pasa los datos a los hijos y muestra los estados de carga, error y vacío.

## Checklist

- [ ] Ningún dumb usa hooks de datos, router ni store.
- [ ] Ningún componente supera ~150 líneas de lógica. Si las supera, divídelo.
- [ ] El dumb es reutilizable con otra fuente de datos.
- [ ] Accesibilidad básica (labels, `alt`, botones reales, `key` estable en listas).
