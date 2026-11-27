import { useQueries } from '@tanstack/react-query'
import { propertiesApi } from '../../../core/api/propertiesApi'
import { gatewayUrl } from '../../../core/config'
import type { PropertySummary } from '../../../core/models/listing'
import { imageDataUrl } from '../../../shared/images/imageDataUrl'

export interface PropertyCoverSource {
  src?: string
  loading: boolean
}

/** Solo la portada de la página visible; las fotos privadas conservan su autorización. */
export function usePropertyCovers(
  properties: PropertySummary[],
): Record<string, PropertyCoverSource> {
  const privatePhoto = (property: PropertySummary) =>
    property.status === 'DRAFT' || property.status === 'PAUSED'
  const privateUrls = [
    ...new Set(
      properties
        .filter(privatePhoto)
        .flatMap((property) => (property.coverImageUrl ? [property.coverImageUrl] : [])),
    ),
  ]
  const results = useQueries({
    queries: privateUrls.map((url) => ({
      queryKey: ['owner-cover', url],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        return imageDataUrl(await propertiesApi.imageBlob(url, signal))
      },
      staleTime: Infinity,
      retry: false,
    })),
  })
  const privateSources = new Map(privateUrls.map((url, index) => [url, results[index]]))
  return Object.fromEntries(
    properties.map((property) => [
      property.id,
      {
        src: privatePhoto(property)
          ? privateSources.get(property.coverImageUrl ?? '')?.data
          : property.coverImageUrl
            ? gatewayUrl(property.coverImageUrl)
            : undefined,
        loading:
          privatePhoto(property) &&
          (privateSources.get(property.coverImageUrl ?? '')?.isPending ?? false),
      },
    ]),
  )
}
