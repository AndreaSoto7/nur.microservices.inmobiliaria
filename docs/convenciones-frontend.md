# Convenciones del frontend

Cómo debe verse y comportarse la UI. Cualquier pantalla nueva sigue estas reglas. Los tokens viven en `frontend/src/index.css`; la arquitectura (Smart y Dumb, carpetas, sesión) está en [`frontend/CLAUDE.md`](../frontend/CLAUDE.md).

**La dirección visual sale del mockup del enunciado:** cabecera azul marino, buscador como acción principal, botón naranja y precio destacado en la tarjeta.

## Regla principal

**Usa siempre un token, nunca un valor suelto.** Si `index.css` no tiene lo que necesitas, agrega el token y su fila aquí, y comprueba el contraste.

```css
/* Bien */
padding: var(--space-4);
color: var(--color-muted);

/* Mal */
padding: 13px;
color: #666;
```

## Paleta

El contraste está medido contra el fondo indicado, según WCAG 2.1 AA: 4.5:1 para texto y 3:1 para bordes de controles.

### Neutros

| Token                  | Valor     | Uso                                           | Contraste                           |
| ---------------------- | --------- | --------------------------------------------- | ----------------------------------- |
| `--color-bg`           | `#f6f5f2` | Fondo de la página                            | —                                   |
| `--color-surface`      | `#ffffff` | Tarjetas y controles                          | —                                   |
| `--color-text`         | `#1b2733` | Texto principal                               | 15.17 sobre surface, 13.91 sobre bg |
| `--color-muted`        | `#56616e` | Texto secundario                              | 6.30 sobre surface, 5.78 sobre bg   |
| `--color-border`       | `#dedcd6` | Bordes de tarjetas y separadores (decorativo) | —                                   |
| `--color-field-border` | `#858b94` | Borde de inputs, selects y chips              | 3.43 sobre surface                  |
| `--color-skeleton`     | `#e6e4de` | Bloques de carga (decorativo)                 | —                                   |

### Marca

| Token                    | Valor     | Uso                                   | Contraste                         |
| ------------------------ | --------- | ------------------------------------- | --------------------------------- |
| `--color-brand`          | `#1f3448` | Cabecera, hero y precios              | 12.78 con blanco                  |
| `--color-brand-hover`    | `#16273a` | Hover sobre el azul marino            | —                                 |
| `--color-brand-tint`     | `#e8edf2` | Selección, chips estáticos y sin foto | —                                 |
| `--color-on-brand`       | `#ffffff` | Texto sobre marca o acento            | —                                 |
| `--color-on-brand-muted` | `#c9d3dd` | Texto secundario sobre marca          | 8.43 sobre brand                  |
| `--color-on-brand-line`  | `#41566b` | Línea sobre marca (decorativo)        | —                                 |
| `--color-accent`         | `#b9521b` | **Solo la acción principal**          | 4.90 con blanco                   |
| `--color-accent-hover`   | `#9c4414` | Hover del acento                      | 6.46 con blanco                   |
| `--color-link`           | `#1f5f8b` | Enlaces y anillo de foco              | 6.84 sobre surface, 6.28 sobre bg |

### Estados

| Token                                    | Valor                 | Uso                 | Contraste |
| ---------------------------------------- | --------------------- | ------------------- | --------- |
| `--color-warning` / `--color-warning-bg` | `#8a5a00` / `#fbf3e0` | Propiedad reservada | 5.36      |
| `--color-error` / `--color-error-bg`     | `#b42318` / `#fef3f2` | Errores             | 6.05      |

**El naranja es escaso a propósito:** como máximo una acción principal en cada zona de la pantalla (Buscar, Ingresar, Crear cuenta). El resto usa `button--secondary`.

Solo hay tema claro: `color-scheme: light`.

## Tipografía

- **Fuente:** la del sistema (`system-ui`). No se cargan fuentes externas: la CSP las bloquea, y no hacen falta.
- **Un solo `h1` por página,** sin saltar niveles.
- **Precios:** `font-variant-numeric: tabular-nums`.

| Token        | Tamaño             | Uso                              |
| ------------ | ------------------ | -------------------------------- |
| `--text-sm`  | 14 px              | Labels, chips y texto secundario |
| `--text-md`  | 16 px              | Texto normal e inputs            |
| `--text-lg`  | 18 px              | Marca y título de estado vacío   |
| `--text-xl`  | 22 px              | `h2` y precios                   |
| `--text-2xl` | 28 px              | `h1`                             |
| `--text-3xl` | 28 a 40 px, fluido | Solo el `h1` del hero            |

## Espacio y forma

- **Espacio:** múltiplos de 4 px, de `--space-1` (4 px) a `--space-10` (40 px).
- **Radios:** `--radius-sm` (4 px), `--radius-md` (8 px, botones e inputs), `--radius-lg` (12 px, tarjetas y fotos), `--radius-pill` (chips y badges).
- **Sombra:** solo `--shadow-raised`, al pasar sobre una tarjeta clicable.
- **Sin degradados.**
- **Altura de controles:** `--control-height` (44 px), para que se puedan tocar en un celular.

## Layout

| Clase           | Ancho máximo | Para                    |
| --------------- | ------------ | ----------------------- |
| `.page`         | 960 px       | Por defecto             |
| `.page--wide`   | 1120 px      | Catálogo y detalle      |
| `.page--narrow` | 440 px       | Formularios y mi cuenta |

- **Toda pantalla va dentro de un `.page`,** que ya trae el margen lateral.
- **Mobile first en la cabeza:** revisa cada pantalla a 320, 768, 1024 y 1440 px. Nada puede desbordar en horizontal.
- **Cortes actuales:** 900 px (filtros a dos columnas), 760 px (detalle a una columna) y 420 px (filtros a una columna).

## Componentes

Antes de crear uno, revisa `shared/ui/`: `Button`, `TextField`, `EmptyState`, `ErrorMessage`, `LoadingState`, `Pagination` e iconos en `icons.tsx`.

- **Botones:** `<Button>` real, nunca un `div` con `onClick`. Variantes `primary` y `secondary`.
- **Tarjeta de propiedad:** en este orden, foto, precio, título, tipo y zona, y datos. El precio es lo primero que se lee.
- **Filtros:** los tres que más se usan quedan a la vista, y el resto en "Más filtros". Esa sección se abre sola si tiene algo aplicado.
- **Orden:** va junto a los resultados y aplica al momento, porque no cambia qué propiedades se buscan.
- **Iconos:** SVG en línea desde `icons.tsx`, con `aria-hidden`. Si un icono es lo único que tiene un botón, ese botón necesita `aria-label`.
- **Texto:** en español, directo y real. Nunca prometas algo que la app todavía no hace, ni pongas botones que no funcionan.

## Estados de una pantalla

Toda pantalla con datos cubre los cuatro:

| Estado        | Cómo se muestra                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Cargando**  | Listas: esqueleto con la forma final (`PropertyGridSkeleton`). Lo demás: `LoadingState`.                                |
| **Vacío**     | `EmptyState`, que explica por qué y qué hacer. Distingue "no hay nada publicado" de "tus filtros no dieron resultados". |
| **Error**     | `ErrorMessage` con el `title` o `detail` del problem+json, y "Reintentar" si tiene sentido.                             |
| **Con datos** | La pantalla normal.                                                                                                     |

Si el `EmptyState` es todo el contenido de la página, usa `titleAs="h1"`.

## Accesibilidad (WCAG 2.1 AA)

- Cada input tiene su `label`, y cada imagen su `alt`. Si la imagen es decorativa, `alt=""`.
- Todo se puede usar con teclado, y el foco se ve (`:focus-visible` global). No lo quites.
- **El color nunca es la única señal:** un filtro activo muestra además su tilde, y "Reservada" lo dice con texto.
- Las animaciones respetan `prefers-reduced-motion`.
- Comprueba cada pantalla nueva con axe.

## Lo que impone la seguridad

La CSP de `frontend/nginx/security-headers.inc.template` bloquea:

- **Estilos en línea:** nada de `style={{ ... }}` en JSX. Todo va en clases.
- **Fuentes, scripts y hojas de estilo externas,** como Google Fonts o un CDN.
- **Imágenes de otros dominios:** solo propias, `data:` o del gateway.

Si de verdad hace falta una excepción, ajusta la CSP en el mismo PR. Estos fallos no aparecen en `npm run dev`, que no tiene CSP: pruébalos en el contenedor.

## Antes de abrir un PR

- [ ] Solo usa tokens, sin valores sueltos ni estilos en línea.
- [ ] Cubre cargando, vacío, error y con datos.
- [ ] No desborda a 320 px, y se ve bien a 768 y 1440 px.
- [ ] Funciona con teclado y axe no marca nada.
- [ ] `npm run test`, `npm run lint` y `npm run build` pasan.
- [ ] Probado en el contenedor si tocaste imágenes, fuentes o estilos externos.
