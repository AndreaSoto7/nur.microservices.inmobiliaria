import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../../../core/api/problem'
import { propertiesApi } from '../../../core/api/propertiesApi'
import { PROPERTY_STATUSES, type PropertyStatus } from '../../../core/models/listing'

function parseStatus(value: string | null): PropertyStatus | undefined {
  return PROPERTY_STATUSES.find((status) => status === value)
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Facade de "Mis propiedades": el estado y la página viven en la URL, como en el catálogo. */
export function useAgentProperties() {
  const [search, setSearch] = useSearchParams()
  const status = parseStatus(search.get('status'))
  const page = parsePage(search.get('page'))

  const result = useQuery({
    queryKey: ['agent-properties', status, page],
    queryFn: ({ signal }) => propertiesApi.list({ status, page }, signal),
    placeholderData: keepPreviousData,
  })

  const changeStatus = useCallback(
    (next: PropertyStatus | undefined) => setSearch(next ? { status: next } : {}),
    [setSearch],
  )

  const goToPage = useCallback(
    (next: number) =>
      setSearch({ ...(status ? { status } : {}), ...(next > 1 ? { page: String(next) } : {}) }),
    [setSearch, status],
  )

  return {
    status,
    changeStatus,
    goToPage,
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
  }
}
