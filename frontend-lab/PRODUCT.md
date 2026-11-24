# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos usuarios principales, confirmados por el responsable del proyecto:

- **Familias y parejas que buscan** una casa o un departamento para comprar o alquilar. Comparan por zona, tipo, precio y características, guardan favoritas, envían consultas y solicitan visitas.
- **Agentes que publican.** Crean y editan propiedades, cargan la galería, administran el estado de cada publicación, atienden consultas y solicitudes de visita, programan visitas y dan seguimiento a las oportunidades.

Roles secundarios: `ADMIN`, que administra usuarios.

## Product Purpose

Plataforma donde una inmobiliaria o un agente publica casas y departamentos en venta o alquiler, y los interesados los encuentran y piden verlos. Proyecto académico de Ingeniería Web 3 (NUR). Éxito: que una familia llegue de la búsqueda a una visita solicitada, y que un agente sepa qué tiene pendiente hoy.

## Positioning

Por decidir. No hay un posicionamiento comercial confirmado.

## Operating Context

- Zonas reales de los datos actuales: Centro, Norte, Las Palmas, Urubó, Equipetrol (Santa Cruz de la Sierra, Bolivia).
- Moneda única: BOB, mostrada como "Bs". En alquiler el precio se muestra por mes.
- El interfaz está en español.
- Una propiedad puede recibir muchas consultas y solicitudes, y cambia entre `PUBLISHED`, `PAUSED`, `RESERVED`, `SOLD` y `RENTED`. Tras ganar una oportunidad, la reserva llega unos instantes después (consistencia eventual).

## Capabilities and Constraints

- Catálogo público con filtros en la URL, detalle con galería, favoritos, avisos, consultas, visitas, panel de agente y administración de usuarios.
- No hay mapas reales, pagos ni contratos electrónicos (fuera de alcance).
- No hay endpoint para listar notas de seguimiento. Una oportunidad solo trae `clientId`, sin nombre.
- `frontend-lab/` es una copia temporal para evaluar diseño: conserva hooks, rutas, modelos y lógica de `frontend/`. Solo cambia la presentación.

## Brand Commitments

El nombre visible actual es "Plataforma Inmobiliaria". No hay logo ni marca confirmados. La paleta y la tipografía se pueden cambiar.

Lo que el responsable rechaza de forma explícita: que parezca una plantilla de IA.

## Evidence on Hand

Seis propiedades reales en el catálogo, todas con foto, servidas por el gateway. No hay testimonios, cifras de clientes ni agentes públicos: no se inventan.

## Product Principles

1. Lo que decide una búsqueda (zona, precio, foto, tipo) se ve antes que cualquier adorno.
2. El agente ve primero lo pendiente.
3. El estado de una propiedad o una visita nunca es ambiguo.
4. Solo datos reales de la API.

## Accessibility & Inclusion

Se mantiene el mínimo del proyecto: WCAG 2.1 AA de contraste, labels en inputs, botones reales, foco visible.
