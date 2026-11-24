/** Funciones puras de la vista del catálogo (lista + mapa), con tests. */

export interface ZoneCount {
  zone: string
  count: number
}

/** Zonas de una página de resultados, de la que más tiene a la que menos. */
export function zonesOf(properties: { zone: string }[]): ZoneCount[] {
  const counts = new Map<string, number>()
  for (const { zone } of properties) counts.set(zone, (counts.get(zone) ?? 0) + 1)
  return [...counts]
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count || a.zone.localeCompare(b.zone, 'es'))
}

/** Cuántas propiedades no se pueden mostrar en el mapa porque no tienen coordenadas. */
export function countWithoutLocation(
  properties: { latitude?: number | null; longitude?: number | null }[],
): number {
  return properties.filter((p) => p.latitude == null || p.longitude == null).length
}

/** Id de la fila de una propiedad: el mapa la lleva a la vista al tocar su marcador. */
export function rowId(propertyId: string): string {
  return `property-${propertyId}`
}
