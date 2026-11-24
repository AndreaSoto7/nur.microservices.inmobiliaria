import { memo } from 'react'
import { CloseIcon } from '../../../shared/ui/icons'
import type { ZoneCount } from '../catalogView'

interface ZoneChipsProps {
  /** Zonas de los resultados que se ven, con cuántas propiedades tiene cada una. */
  zones: ZoneCount[]
  /** Lo que se buscó en el campo Zona, si se buscó algo. */
  activeZone?: string
  onPick: (zone: string) => void
  onClear: () => void
}

/** Dumb: atajos para filtrar por una zona de los resultados, o quitar el filtro de zona. */
export const ZoneChips = memo(function ZoneChips({
  zones,
  activeZone,
  onPick,
  onClear,
}: ZoneChipsProps) {
  if (activeZone) {
    return (
      <div className="zone-chips">
        <button type="button" className="zone-chip is-active" onClick={onClear}>
          Zona: {activeZone}
          <CloseIcon className="zone-chip__icon" />
          <span className="visually-hidden">(quitar filtro)</span>
        </button>
      </div>
    )
  }
  if (zones.length < 2) return null
  return (
    <div className="zone-chips" role="group" aria-label="Filtrar por zona">
      {zones.map(({ zone, count }) => (
        <button key={zone} type="button" className="zone-chip" onClick={() => onPick(zone)}>
          {zone}
          <span className="zone-chip__count">{count}</span>
        </button>
      ))}
    </div>
  )
})
