import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorMessage } from '../../../core/api/problem'
import { propertiesApi } from '../../../core/api/propertiesApi'
import type {
  CreatePropertyRequest,
  EditPropertyRequest,
  UpdateFeaturesRequest,
} from '../../../core/models/listing'
import { invalidateProperty } from '../properties-admin/usePropertyTransition'

function mutationState(mutation: { isPending: boolean; error: Error | null }) {
  return {
    submitting: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
    fieldErrors: mutation.error instanceof ApiError ? mutation.error.fieldErrors : {},
  }
}

const CREATE_TIMEOUT_MESSAGE =
  'El servidor tardó demasiado y puede que el borrador se haya creado igual. Revisa Mis propiedades antes de volver a intentarlo.'

/** Facade de crear una propiedad. */
export function useCreateProperty() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (request: CreatePropertyRequest) => propertiesApi.create(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-properties'] }),
  })
  const state = mutationState(mutation)
  // El POST no es idempotente: si se cortó la espera, el borrador pudo guardarse igual.
  const timedOut = mutation.error instanceof ApiError && mutation.error.status === 504
  return {
    createProperty: mutation.mutateAsync,
    ...state,
    error: timedOut ? CREATE_TIMEOUT_MESSAGE : state.error,
  }
}

/** Facade de editar una propiedad. Un 404 es "no encontrada", no un error técnico. */
export function useEditProperty(propertyId: string) {
  const queryClient = useQueryClient()
  const result = useQuery({
    queryKey: ['agent-property', propertyId],
    queryFn: ({ signal }) => propertiesApi.get(propertyId, signal),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
  const notFound = result.error instanceof ApiError && result.error.status === 404

  const save = useMutation({
    mutationFn: (request: EditPropertyRequest) => propertiesApi.update(propertyId, request),
    onSuccess: () => invalidateProperty(queryClient, propertyId),
  })

  return {
    property: result.data,
    loading: result.isPending,
    notFound,
    loadError: result.isError && !notFound ? errorMessage(result.error) : undefined,
    retry: result.refetch,
    saveProperty: save.mutate,
    saved: save.isSuccess,
    ...mutationState(save),
  }
}

/** Facade de las características de una propiedad. */
export function useUpdateFeatures(propertyId: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (request: UpdateFeaturesRequest) =>
      propertiesApi.updateFeatures(propertyId, request),
    onSuccess: () => invalidateProperty(queryClient, propertyId),
  })
  return { saveFeatures: mutation.mutate, saved: mutation.isSuccess, ...mutationState(mutation) }
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
