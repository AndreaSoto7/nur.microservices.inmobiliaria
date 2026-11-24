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
 * Dumb: edita un borrador local y avisa con onFiltersChange al buscar. Para reiniciarlo cuando cambia
 * la URL, el container le pasa un `key` distinto.
 */
export const PropertyFilters = memo(function PropertyFilters({
  value,
  onFiltersChange,
}: PropertyFiltersProps) {
  const [draft, setDraft] = useState<CatalogFilters>(value)

  function update<K extends keyof CatalogFilters>(key: K, next: CatalogFilters[K]) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  function toggleFeature(feature: Feature) {
    setDraft((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onFiltersChange({ ...draft, zone: draft.zone?.trim() || undefined })
  }

  const advancedCount = advancedFilterCount(value)

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
              update('operation', (event.target.value || undefined) as CatalogFilters['operation'])
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
              update('type', (event.target.value || undefined) as CatalogFilters['type'])
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
      <details className="filters__more" open={advancedCount > 0}>
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
                onChange={(event) => update('bedrooms', numberOrUndefined(event.target.value))}
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
