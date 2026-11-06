import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useIdempotencyKey } from '../../../core/api/idempotency'
import { errorMessage } from '../../../core/api/problem'
import { visitsApi } from '../../../core/api/visitsApi'
import { VISIT_STATUSES, type VisitStatus } from '../../../core/models/visit'
import { parsePageParam } from '../../../shared/format/pageParam'

export type VisitAction =
  | { kind: 'schedule'; visitId: string; scheduledStart: string }
  | { kind: 'reject'; visitId: string; reason: string }
  | { kind: 'cancel'; visitId: string; reason?: string }
  | { kind: 'complete'; visitId: string }

function runAction(action: VisitAction, key: string) {
  switch (action.kind) {
    case 'schedule':
      return visitsApi.schedule(action.visitId, action.scheduledStart, key)
    case 'reject':
      return visitsApi.reject(action.visitId, action.reason, key)
    case 'cancel':
      return visitsApi.cancel(action.visitId, action.reason, key)
    case 'complete':
      return visitsApi.complete(action.visitId, key)
  }
}

/** Facade de las solicitudes del agente: el estado y la página viven en la URL. */
export function useAgentVisits() {
  const queryClient = useQueryClient()
  const keyFor = useIdempotencyKey()
  const [search, setSearch] = useSearchParams()
  const status = VISIT_STATUSES.find((candidate) => candidate === search.get('status'))
  const page = parsePageParam(search.get('page'))

  const result = useQuery({
    queryKey: ['agent-visits', status, page],
    queryFn: ({ signal }) => visitsApi.list({ status, page }, signal),
    placeholderData: keepPreviousData,
  })

  const action = useMutation({
    mutationFn: (input: VisitAction) => runAction(input, keyFor(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-visits'] }),
  })

  const changeStatus = useCallback(
    (next: VisitStatus | undefined) => setSearch(next ? { status: next } : {}),
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
    runAction: action.mutate,
    busyVisitId: action.isPending ? action.variables.visitId : null,
    /** El error se muestra en la fila que lo causó: arriba de la lista podría quedar fuera de vista. */
    failedVisitId: action.isError ? action.variables.visitId : null,
    actionError: action.error ? errorMessage(action.error) : undefined,
  }
}
