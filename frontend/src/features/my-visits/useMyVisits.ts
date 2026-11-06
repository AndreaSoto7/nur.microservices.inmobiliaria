import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useIdempotencyKey } from '../../core/api/idempotency'
import { errorMessage } from '../../core/api/problem'
import { visitsApi } from '../../core/api/visitsApi'
import { VISIT_STATUSES, type VisitStatus } from '../../core/models/visit'
import { parsePageParam } from '../../shared/format/pageParam'

interface CancelInput {
  visitId: string
  reason?: string
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

  const cancel = useMutation({
    mutationFn: (input: CancelInput) =>
      visitsApi.cancel(input.visitId, input.reason, keyFor(input)),
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
    cancelVisit: cancel.mutate,
    cancellingId: cancel.isPending ? cancel.variables.visitId : null,
    cancelError: cancel.error ? errorMessage(cancel.error) : undefined,
  }
}
