import {
  FEATURES,
  OPERATION_TYPES,
  PROPERTY_TYPES,
  type Feature,
  type OperationType,
  type PropertyType,
} from '../../core/models/listing'

/** Órdenes que ofrece la UI. El contrato acepta `campo,asc|desc` con price, publishedAt, areaM2 y bedrooms. */
export const CATALOG_SORTS = ['publishedAt,desc', 'price,asc', 'price,desc', 'areaM2,desc'] as const
export type CatalogSort = (typeof CATALOG_SORTS)[number]

export const PAGE_SIZE = 12

export interface CatalogFilters {
  zone?: string
  type?: PropertyType
  operation?: OperationType
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  features: Feature[]
  sort: CatalogSort
  page: number
}

export const DEFAULT_FILTERS: CatalogFilters = { features: [], sort: 'publishedAt,desc', page: 1 }

/**
 * Los filtros viven en la URL (frontend/CLAUDE.md): se pueden compartir, recargar y volver atrás.
 * Lo que no se reconoce se descarta en vez de romper la página.
 */
export function filtersFromSearch(search: URLSearchParams): CatalogFilters {
  const zone = search.get('zone')?.trim()
  return {
    zone: zone ? zone : undefined,
    type: oneOf(PROPERTY_TYPES, search.get('type')),
    operation: oneOf(OPERATION_TYPES, search.get('operation')),
    minPrice: nonNegative(search.get('minPrice')),
    maxPrice: nonNegative(search.get('maxPrice')),
    bedrooms: nonNegativeInteger(search.get('bedrooms')),
    features: (search.get('features') ?? '')
      .split(',')
      .filter((value): value is Feature => (FEATURES as readonly string[]).includes(value)),
    sort: oneOf(CATALOG_SORTS, search.get('sort')) ?? DEFAULT_FILTERS.sort,
    page: Math.max(1, nonNegativeInteger(search.get('page')) ?? 1),
  }
}

/** Solo escribe lo que difiere del valor por defecto: la URL queda corta. */
export function filtersToSearch(filters: CatalogFilters): URLSearchParams {
  const search = new URLSearchParams()
  if (filters.zone) search.set('zone', filters.zone)
  if (filters.type) search.set('type', filters.type)
  if (filters.operation) search.set('operation', filters.operation)
  if (filters.minPrice !== undefined) search.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) search.set('maxPrice', String(filters.maxPrice))
  if (filters.bedrooms !== undefined) search.set('bedrooms', String(filters.bedrooms))
  if (filters.features.length > 0) search.set('features', filters.features.join(','))
  if (filters.sort !== DEFAULT_FILTERS.sort) search.set('sort', filters.sort)
  if (filters.page > 1) search.set('page', String(filters.page))
  return search
}

/** Query string de GET /api/v1/catalog/properties (los nombres coinciden con el contrato). */
export function catalogQuery(filters: CatalogFilters): string {
  const query = filtersToSearch(filters)
  query.set('sort', filters.sort)
  query.set('page', String(filters.page))
  query.set('size', String(PAGE_SIZE))
  return query.toString()
}

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function nonNegative(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function nonNegativeInteger(value: string | null): number | undefined {
  const number = nonNegative(value)
  return number !== undefined && Number.isInteger(number) ? number : undefined
}
