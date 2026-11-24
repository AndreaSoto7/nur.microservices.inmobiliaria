import { memo } from 'react'
import { CATALOG_SORTS, type CatalogSort } from '../catalogFilters'

const SORT_LABELS: Record<CatalogSort, string> = {
  'publishedAt,desc': 'Más recientes',
  'price,asc': 'Menor precio',
  'price,desc': 'Mayor precio',
  'areaM2,desc': 'Mayor superficie',
}

interface SortSelectProps {
  value: CatalogSort
  onSortChange: (sort: CatalogSort) => void
}

/** Dumb: ordena lo que ya se ve, así que aplica de inmediato y no espera a "Buscar". */
export const SortSelect = memo(function SortSelect({ value, onSortChange }: SortSelectProps) {
  return (
    <label className="sort-select">
      Ordenar por
      <select
        className="select"
        value={value}
        onChange={(event) => onSortChange(event.target.value as CatalogSort)}
      >
        {CATALOG_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>
    </label>
  )
})
