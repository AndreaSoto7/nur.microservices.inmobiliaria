---
name: componente-front
description: Crea o refactoriza componentes del frontend aplicando el patrón Smart/Dumb (contenedor y presentacional). Úsala al construir pantallas como el catálogo, el detalle de propiedad, favoritos, mis visitas o el panel del agente, o al partir un "componente Dios".
argument-hint: "[pantalla o componente]"
---

# Componentes Smart / Dumb

Pantalla o componente: $ARGUMENTS

Sigue `.claude/rules/frontend-smart-dumb.md`. Revisa en `docs/adr/` qué framework eligió el equipo y usa su sintaxis idiomática.

## 1. Descomponer antes de programar

Dibuja el árbol de componentes y márcalo así:

```
CatalogPageComponent (SMART)  ← search API vía facade, filtros en la URL
├── PropertyFiltersComponent (DUMB)   in: filters, zones   out: filtersChange
├── PropertyCardListComponent (DUMB)  in: properties       out: select, toggleFavorite
│   └── PropertyCardComponent (DUMB)  in: property         out: select, toggleFavorite
└── PaginationComponent (DUMB)        in: page             out: pageChange
```

Para cada dumb, define sus **inputs** y **outputs**. Para el smart, define de dónde saca los datos y qué acción ejecuta ante cada output.

## 2. Implementar

**Dumb:**
- Solo inputs y outputs. Sin servicios de datos, sin router, sin store.
- `OnPush` en Angular o componente puro en React.
- Maneja sus estados visuales a partir de los inputs: vacío, deshabilitado.

**Smart:**
- Usa un facade, servicio o store. Pasa los datos hacia abajo y traduce los outputs en acciones.
- Maneja `loading`, `error` (problem+json) y `empty`.

**Modelos:**
- Los tipos TypeScript coinciden con `contracts/openapi/`.
- Las llamadas HTTP solo en `core/` y siempre vía gateway.

## 3. Tests

- **Dumb:** renderiza según los inputs y emite el output correcto ante la interacción.
- **Smart:** llama al facade o servicio correcto y pasa los datos a los hijos (con mocks).

## Checklist

- [ ] Ningún dumb inyecta servicios de datos.
- [ ] Ningún componente supera ~150 líneas de lógica. Si las supera, divídelo.
- [ ] El dumb es reutilizable con otra fuente de datos.
- [ ] Accesibilidad básica (labels, `alt`, botones reales).
