import { useQueries } from '@tanstack/react-query'
import { catalogApi } from '../../core/api/catalogApi'
import { propertiesApi } from '../../core/api/propertiesApi'

export type PropertySource = 'catalog' | 'agent'

const SOURCES = {
  catalog: { key: 'catalog-property', get: catalogApi.get },
  agent: { key: 'agent-property', get: propertiesApi.get },
}

/**
 * Las visitas solo traen `propertyId`, y no se cruzan datos entre servicios en el backend: el título
 * se pide aparte. El interesado lo busca en el catálogo; el agente, en sus propiedades, porque ve
 * también las que no están publicadas. Lo que no se encuentra queda sin título.
 */
export function usePropertyTitles(
  propertyIds: string[],
  source: PropertySource,
): Record<string, string> {
  const { key, get } = SOURCES[source]
  const ids = [...new Set(propertyIds)]
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: [key, id],
      queryFn: ({ signal }: { signal: AbortSignal }) => get(id, signal),
      retry: false,
    })),
  })
  const titles: Record<string, string> = {}
  results.forEach((result, index) => {
    if (result.data) titles[ids[index]] = result.data.title
  })
  return titles
}
