import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { FEATURES, type Feature } from '../../../core/models/listing'
import {
  FEATURE_LABELS,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../shared/format/property'
import { Button } from '../../../shared/ui/Button'
import {
  advancedFilterCount,
  DEFAULT_FILTERS,
  hasActiveFilters,
  type CatalogFilters,
} from '../catalogFilters'

interface PropertyFiltersProps {
  value: CatalogFilters
  onFiltersChange: (filters: CatalogFilters) => void
}

/**
 * Dumb: lo que se elige (operación, tipo, dormitorios, características) se aplica al momento; lo que se
 * escribe (zona y precios) espera a "Buscar" o Enter, para no buscar a cada tecla. Cuando la URL cambia
 * desde afuera (atajos de zona, limpiar, orden), el borrador vuelve a lo que dice la URL.
 */
export const PropertyFilters = memo(function PropertyFilters({
  value,
  onFiltersChange,
}: PropertyFiltersProps) {
  const [draft, setDraft] = useState<CatalogFilters>(value)
  const [applied, setApplied] = useState(value)
  const advancedCount = advancedFilterCount(value)
  // "Más filtros" queda como lo dejó la persona: no se cierra al quitar el último filtro.
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0)
  if (applied !== value) {
    setApplied(value)
    setDraft(value)
    if (advancedFilterCount(value) > 0) setMoreOpen(true)
  }

  function update<K extends keyof CatalogFilters>(key: K, next: CatalogFilters[K]) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  function apply(next: CatalogFilters) {
    setDraft(next)
    onFiltersChange({ ...next, zone: next.zone?.trim() || undefined })
  }

  /** Para selects y casillas: elegir ya es la intención, no hace falta "Buscar". */
  function applyNow<K extends keyof CatalogFilters>(key: K, next: CatalogFilters[K]) {
    apply({ ...draft, [key]: next })
  }

  function toggleFeature(feature: Feature) {
    applyNow(
      'features',
      draft.features.includes(feature)
        ? draft.features.filter((item) => item !== feature)
        : [...draft.features, feature],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    apply(draft)
  }

  return (
    <form className="filters card" onSubmit={handleSubmit} aria-label="Filtros del catálogo">
      <div className="filters__primary">
        <label className="field filters__zone">
          Zona
          <input
            type="search"
            placeholder="Equipetrol, Urubó…"
            maxLength={100}
            value={draft.zone ?? ''}
            onChange={(event) => update('zone', event.target.value)}
          />
        </label>
        <label className="field">
          Operación
          <select
            value={draft.operation ?? ''}
            onChange={(event) =>
              applyNow(
                'operation',
                (event.target.value || undefined) as CatalogFilters['operation'],
              )
            }
          >
            <option value="">Venta o alquiler</option>
            {Object.entries(OPERATION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tipo
          <select
            value={draft.type ?? ''}
            onChange={(event) =>
              applyNow('type', (event.target.value || undefined) as CatalogFilters['type'])
            }
          >
            <option value="">Cualquiera</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="filters__submit">
          Buscar
        </Button>
      </div>
      <details
        className="filters__more"
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
      >
        <summary>{advancedCount > 0 ? `Más filtros (${advancedCount})` : 'Más filtros'}</summary>
        <div className="filters__more-body">
          <div className="filters__secondary">
            <label className="field">
              Precio mínimo (Bs)
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.minPrice ?? ''}
                onChange={(event) => update('minPrice', numberOrUndefined(event.target.value))}
              />
            </label>
            <label className="field">
              Precio máximo (Bs)
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.maxPrice ?? ''}
                onChange={(event) => update('maxPrice', numberOrUndefined(event.target.value))}
              />
            </label>
            <label className="field">
              Dormitorios
              <select
                value={draft.bedrooms ?? ''}
                onChange={(event) => applyNow('bedrooms', numberOrUndefined(event.target.value))}
              >
                <option value="">Cualquiera</option>
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count} o más
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="filters__features">
            <legend>Características</legend>
            {FEATURES.map((feature) => (
              <label key={feature} className="chip">
                <input
                  type="checkbox"
                  checked={draft.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                />
                {FEATURE_LABELS[feature]}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
      {hasActiveFilters(value) && (
        <div className="filters__actions">
          <Button
            variant="secondary"
            onClick={() => onFiltersChange({ ...DEFAULT_FILTERS, sort: value.sort })}
          >
            Limpiar filtros
          </Button>
        </div>
      )}
    </form>
  )
})

function numberOrUndefined(value: string): number | undefined {
  if (value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}
