import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorMessage } from '../../../core/api/problem'
import { propertiesApi } from '../../../core/api/propertiesApi'
import { gatewayUrl } from '../../../core/config'
import type { PropertyDetail } from '../../../core/models/listing'
import { invalidateProperty } from '../properties-admin/usePropertyTransition'

/** Facade de la propiedad que se edita. Un 404 es "no encontrada", no un error técnico. */
export function useEditProperty(propertyId: string) {
  const result = useQuery({
    queryKey: ['agent-property', propertyId],
    queryFn: ({ signal }) => propertiesApi.get(propertyId, signal),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
  const notFound = result.error instanceof ApiError && result.error.status === 404

  return {
    property: result.data,
    loading: result.isPending,
    notFound,
    loadError: result.isError && !notFound ? errorMessage(result.error) : undefined,
    retry: result.refetch,
  }
}

/** Facade para quitar una foto de la galería. */
export function useRemoveImage(propertyId: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (imageId: string) => propertiesApi.removeImage(propertyId, imageId),
    onSuccess: () => invalidateProperty(queryClient, propertyId),
  })
  return {
    removeImage: mutation.mutate,
    removingId: mutation.isPending ? mutation.variables : undefined,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
  }
}

/**
 * De dónde sale cada miniatura. Si la propiedad es visible, la URL pública; si es un borrador o está
 * pausada, listing solo se la da a su agente: se pide con el token y se muestra como data: URL (la CSP del
 * frontend admite data:, no blob:).
 */
export function useImageSources(property: PropertyDetail): Record<string, string | undefined> {
  const visible = property.status !== 'DRAFT' && property.status !== 'PAUSED'
  const results = useQueries({
    queries: property.images.map((image) => ({
      queryKey: ['owner-image', image.id],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        toDataUrl(await propertiesApi.imageBlob(image.url, signal)),
      enabled: !visible,
      staleTime: Infinity,
    })),
  })
  return Object.fromEntries(
    property.images.map((image, index) => [
      image.id,
      visible ? gatewayUrl(image.url) : results[index]?.data,
    ]),
  )
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Facade de la subida de fotos. */
export function useUploadImages(propertyId: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (files: File[]) => propertiesApi.uploadImages(propertyId, files),
    onSuccess: () => invalidateProperty(queryClient, propertyId),
  })
  return {
    uploadImages: mutation.mutate,
    uploading: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
  }
}
