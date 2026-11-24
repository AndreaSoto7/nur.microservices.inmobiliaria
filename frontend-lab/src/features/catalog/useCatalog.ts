import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { catalogApi } from '../../core/api/catalogApi'
import { errorMessage } from '../../core/api/problem'
import {
  catalogQuery,
  filtersFromSearch,
  filtersToSearch,
  type CatalogFilters,
} from './catalogFilters'

/**
 * Facade del catálogo: la página no conoce la API, React Query ni el formato de la URL. Los filtros
 * salen de la URL y vuelven a ella; cambiar un filtro vuelve a la página 1.
 */
export function useCatalog() {
  const [search, setSearch] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(search), [search])
  const query = catalogQuery(filters)

  const result = useQuery({
    queryKey: ['catalog', query],
    queryFn: ({ signal }) => catalogApi.search(query, signal),
    // Mientras llega la página nueva se sigue viendo la anterior (sin parpadeo a "cargando").
    placeholderData: keepPreviousData,
  })

  const applyFilters = useCallback(
    (next: CatalogFilters) => setSearch(filtersToSearch({ ...next, page: 1 })),
    [setSearch],
  )

  const goToPage = useCallback(
    (page: number) => setSearch(filtersToSearch({ ...filters, page })),
    [filters, setSearch],
  )

  return {
    filters,
    /** Identifica el estado de la URL: sirve de `key` para reiniciar el formulario de filtros. */
    filtersKey: search.toString(),
    applyFilters,
    goToPage,
    page: result.data,
    loading: result.isPending,
    refreshing: result.isFetching && !result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
  }
}
