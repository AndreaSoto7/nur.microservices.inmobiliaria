---
version: 1
slug: 'src-app-app-tsx'
primary_target: 'src/app/App.tsx'
related_targets: []
---

# Superficie: frontend-lab completo

Modo: Operate. Audiencia: familias y parejas que buscan, y agentes que publican. Vara de calidad: Airbnb (búsqueda con mapa).

## Direction contract

THESIS: buscar casa es mirar la ciudad: el catálogo se lee junto a un mapa real de Santa Cruz donde cada propiedad es su precio. Rechaza la grilla de tarjetas sin lugar y el esquema decorativo de anillos.

OWN-WORLD: índigo #1C1B3A como tinta y como cabecera; amarillo de señalización #F2B705 para la acción principal y lo activo; magenta oscuro #B4235C solo para el nombre de la zona; fondo #F5F6F2. Barlow en todo, con números tabulares. Marcadores en píldora blanca con el precio; el activo se vuelve índigo.

STORY: una familia escribe una zona (aunque sea "uru"), ve en el mapa dónde quedan las casas, pasa el cursor por una fila y su precio se ilumina en el mapa, abre la ficha, ve la ubicación y pide una visita. El agente marca la ubicación al publicar y revisa sus fotos antes de subirlas.

FIRST VIEWPORT: cabecera índigo; debajo, barra de búsqueda blanca a todo el ancho (zona, operación, tipo, más filtros, Buscar en amarillo). Luego, a la izquierda, el h1, el conteo y las filas de propiedades (foto, zona en magenta, título, datos y precio a la derecha); a la derecha, fijo, el mapa con los precios. En celular, la lista y un botón "Mapa" flotante que cambia a la vista de mapa.

FORM: dirección "Anillos y radiales" fijada por el responsable, con el esquema de anillos reemplazado por un mapa real (OpenStreetMap vía Leaflet). seed: none (unavailable). Interacción firma: la fila y el marcador se encienden juntos; tocar un marcador abre su tarjeta y lleva la fila a la vista.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
