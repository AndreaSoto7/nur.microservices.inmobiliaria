import { useQueries } from '@tanstack/react-query'
import { catalogApi } from '../../core/api/catalogApi'

/**
 * Las consultas solo traen `propertyId`: el interesado busca el título en el catálogo público. Una
 * propiedad que ya no está publicada responde 404 y queda sin título.
 */
export function useCatalogTitles(propertyIds: string[]): Record<string, string> {
  const ids = [...new Set(propertyIds)]
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['catalog-property', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => catalogApi.get(id, signal),
      retry: false,
    })),
  })
  const titles: Record<string, string> = {}
  results.forEach((result, index) => {
    if (result.data) titles[ids[index]] = result.data.title
  })
  return titles
}
