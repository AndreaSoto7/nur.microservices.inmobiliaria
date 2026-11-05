/** Única URL de backend: el gateway (frontend/CLAUDE.md). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
)

/** Las APIs devuelven rutas relativas al gateway (p. ej. las imágenes): esto las vuelve absolutas. */
export function gatewayUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
