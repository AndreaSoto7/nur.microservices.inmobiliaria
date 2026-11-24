import { useMutation, useQueryClient } from '@tanstack/react-query'
import { propertiesApi } from '../../../core/api/propertiesApi'
import { errorMessage } from '../../../core/api/problem'
import type { PropertyTransition } from '../../../core/models/listing'

interface TransitionInput {
  propertyId: string
  transition: PropertyTransition
}

/** Vuelve a consultar todo lo que muestra una propiedad, porque su estado o sus datos cambiaron. */
export function invalidateProperty(
  queryClient: ReturnType<typeof useQueryClient>,
  propertyId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['agent-properties'] }),
    queryClient.invalidateQueries({ queryKey: ['agent-property', propertyId] }),
    queryClient.invalidateQueries({ queryKey: ['catalog'] }),
    queryClient.invalidateQueries({ queryKey: ['catalog-property', propertyId] }),
  ])
}

/** Facade de los cambios de estado: lo usan la lista y la edición de una propiedad. */
export function usePropertyTransition() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ propertyId, transition }: TransitionInput) =>
      propertiesApi.transition(propertyId, transition),
    onSuccess: (_result, { propertyId }) => invalidateProperty(queryClient, propertyId),
  })

  return {
    runTransition: mutation.mutate,
    pendingPropertyId: mutation.isPending ? mutation.variables.propertyId : null,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
  }
}
