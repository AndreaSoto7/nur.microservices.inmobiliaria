import { useQueries } from '@tanstack/react-query'
import { propertiesApi } from '../../core/api/propertiesApi'

/**
 * Las consultas y las oportunidades solo traen `propertyId`, y no se cruzan datos entre servicios en
 * el backend: el título se pide aparte. El agente lo busca en sus propiedades, porque ve también las
 * que no están publicadas. Lo que no se encuentra queda sin título.
 */
export function usePropertyTitles(propertyIds: string[]): Record<string, string> {
  const ids = [...new Set(propertyIds)]
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['agent-property', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => propertiesApi.get(id, signal),
      retry: false,
    })),
  })
  const titles: Record<string, string> = {}
  results.forEach((result, index) => {
    if (result.data) titles[ids[index]] = result.data.title
  })
  return titles
}
