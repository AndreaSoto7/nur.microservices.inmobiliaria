import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useIdempotencyKey } from '../../../core/api/idempotency'
import { leadsApi } from '../../../core/api/leadsApi'
import { errorMessage } from '../../../core/api/problem'
import { LEAD_STATUSES, type LeadOutcome, type LeadStatus } from '../../../core/models/visit'
import { parsePageParam } from '../../../shared/format/pageParam'

export type LeadAction =
  | { kind: 'note'; leadId: string; note: string }
  | { kind: 'close'; leadId: string; outcome: LeadOutcome; note?: string }

/** Facade de las oportunidades del agente: el estado y la página viven en la URL. */
export function useAgentLeads() {
  const queryClient = useQueryClient()
  const keyFor = useIdempotencyKey()
  const [search, setSearch] = useSearchParams()
  const status = LEAD_STATUSES.find((candidate) => candidate === search.get('status'))
  const page = parsePageParam(search.get('page'))

  const result = useQuery({
    queryKey: ['agent-leads', status, page],
    queryFn: ({ signal }) => leadsApi.list({ status, page }, signal),
    placeholderData: keepPreviousData,
  })

  const action = useMutation({
    mutationFn: async (input: LeadAction) => {
      if (input.kind === 'note') {
        await leadsApi.addFollowUp(input.leadId, input.note, keyFor(input))
        return
      }
      const { outcome, note } = input
      await leadsApi.close(input.leadId, { outcome, ...(note ? { note } : {}) }, keyFor(input))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-leads'] }),
  })

  const changeStatus = useCallback(
    (next: LeadStatus | undefined) => setSearch(next ? { status: next } : {}),
    [setSearch],
  )

  const goToPage = useCallback(
    (next: number) =>
      setSearch({ ...(status ? { status } : {}), ...(next > 1 ? { page: String(next) } : {}) }),
    [setSearch, status],
  )

  const done = action.isSuccess ? action.variables : null

  return {
    status,
    changeStatus,
    goToPage,
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
    runAction: action.mutate,
    busyLeadId: action.isPending ? action.variables.leadId : null,
    failedLeadId: action.isError ? action.variables.leadId : null,
    actionError: action.error ? errorMessage(action.error) : undefined,
    noteSavedLeadId: done?.kind === 'note' ? done.leadId : null,
    /** La reserva la hace listing al recibir el evento: la UI no la da por hecha todavía. */
    reservingLeadId: done?.kind === 'close' && done.outcome === 'WON' ? done.leadId : null,
  }
}
