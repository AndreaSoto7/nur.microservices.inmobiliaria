import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, errorMessage } from '../../../core/api/problem'
import { propertiesApi } from '../../../core/api/propertiesApi'
import type { CreatePropertyRequest, EditPropertyRequest } from '../../../core/models/listing'
import { invalidateProperty } from '../properties-admin/usePropertyTransition'

function mutationState(mutation: { isPending: boolean; error: Error | null }) {
  return {
    submitting: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
    fieldErrors: mutation.error instanceof ApiError ? mutation.error.fieldErrors : {},
  }
}

/** Facade de crear una propiedad. */
export function useCreateProperty() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (request: CreatePropertyRequest) => propertiesApi.create(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-properties'] }),
  })
  return { createProperty: mutation.mutateAsync, ...mutationState(mutation) }
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
