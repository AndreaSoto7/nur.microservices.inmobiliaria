import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '../../core/api/catalogApi'
import { ApiError, errorMessage } from '../../core/api/problem'

/**
 * Facade del detalle público. Un 404 no es un error técnico: la propiedad no existe o ya no está en
 * el catálogo (pausada, vendida o alquilada), y se muestra distinto.
 */
export function usePropertyDetail(propertyId: string) {
  const result = useQuery({
    queryKey: ['catalog-property', propertyId],
    queryFn: ({ signal }) => catalogApi.get(propertyId, signal),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
  const notFound = result.error instanceof ApiError && result.error.status === 404

  return {
    property: result.data,
    loading: result.isPending,
    notFound,
    error: result.isError && !notFound ? errorMessage(result.error) : undefined,
    retry: result.refetch,
  }
}
