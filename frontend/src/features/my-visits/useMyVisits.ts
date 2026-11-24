import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useIdempotencyKey } from '../../core/api/idempotency'
import { errorMessage } from '../../core/api/problem'
import { visitsApi } from '../../core/api/visitsApi'
import { VISIT_STATUSES, type VisitStatus } from '../../core/models/visit'
import { parsePageParam } from '../../shared/format/pageParam'

export type MyVisitAction =
  | { kind: 'cancel'; visitId: string; reason?: string }
  | { kind: 'accept'; visitId: string }
  | { kind: 'propose'; visitId: string; proposedAt: string }

function runAction(action: MyVisitAction, key: string) {
  switch (action.kind) {
    case 'cancel':
      return visitsApi.cancel(action.visitId, action.reason, key)
    case 'accept':
      return visitsApi.acceptProposal(action.visitId, key)
    case 'propose':
      return visitsApi.proposeTime(action.visitId, action.proposedAt, key)
  }
}

/** Facade de "Mis visitas": el estado y la página viven en la URL. */
export function useMyVisits() {
  const queryClient = useQueryClient()
  const keyFor = useIdempotencyKey()
  const [search, setSearch] = useSearchParams()
  const status = VISIT_STATUSES.find((candidate) => candidate === search.get('status'))
  const page = parsePageParam(search.get('page'))

  const result = useQuery({
    queryKey: ['my-visits', status, page],
    queryFn: ({ signal }) => visitsApi.list({ status, page }, signal),
    placeholderData: keepPreviousData,
  })

  const action = useMutation({
    mutationFn: (input: MyVisitAction) => runAction(input, keyFor(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-visits'] }),
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
    /** El error se muestra en la fila que lo causó. */
    failedVisitId: action.isError ? action.variables.visitId : null,
    actionError: action.error ? errorMessage(action.error) : undefined,
  }
}
