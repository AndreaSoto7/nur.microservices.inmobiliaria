import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface Coordinates {
  latitude: number
  longitude: number
}

/** Centro de Santa Cruz de la Sierra: donde abre el mapa cuando no hay nada que mostrar. */
export const SANTA_CRUZ: [number, number] = [-17.7833, -63.1821]
export const CITY_ZOOM = 12
export const STREET_ZOOM = 16

/**
 * Mosaicos estándar de OpenStreetMap: no piden clave (CARTO, por ejemplo, ya la exige). Su política de uso
 * alcanza para desarrollo y la demo; en producción conviene un proveedor con cuenta o un servidor propio,
 * que se configura con VITE_MAP_TILE_URL. El CSS les baja la saturación para que los precios manden.
 */
export const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">Colaboradores de OpenStreetMap</a>'

/** Las dos coordenadas o ninguna (contrato de listing). */
export function coordinatesOf(location: {
  latitude?: number | null
  longitude?: number | null
}): Coordinates | null {
  const { latitude, longitude } = location
  if (latitude == null || longitude == null) return null
  return { latitude, longitude }
}

/** Marcador de una sola ubicación (ficha y formulario): un alfiler dibujado, sin imágenes externas. */
export const LOCATION_PIN = L.divIcon({
  className: 'location-pin',
  html: '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1Z"/><circle cx="16" cy="15.5" r="5.5"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 41],
})

/** Texto seguro para meter en el HTML de un divIcon. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
