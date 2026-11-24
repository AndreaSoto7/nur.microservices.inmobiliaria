interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** Plantilla de mosaicos del mapa ({s}, {z}, {x}, {y}, {r}). Por defecto, OpenStreetMap. */
  readonly VITE_MAP_TILE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
