import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useIdempotencyKey } from '../../../core/api/idempotency'
import { leadsApi } from '../../../core/api/leadsApi'
import { errorMessage } from '../../../core/api/problem'
import { visitsApi } from '../../../core/api/visitsApi'
import type { Lead, Visit } from '../../../core/models/visit'
import type { LeadLookup, VisitOutcome } from './components/VisitOutcomeDialog'

interface FinishInput {
  visit: Visit
  lead: Lead | undefined
  outcome: VisitOutcome
  note?: string
}

/**
 * Facade de "Marcar realizada": abre el diálogo, busca la oportunidad abierta del interesado con esa
 * propiedad y, al confirmar, completa la visita y anota o cierra la oportunidad. Cada paso lleva su
 * clave de idempotencia: si falla el último, reintentar no repite los anteriores.
 */
export function useVisitOutcome() {
  const queryClient = useQueryClient()
  const completeKey = useIdempotencyKey()
  const noteKey = useIdempotencyKey()
  const closeKey = useIdempotencyKey()
  const [visit, setVisit] = useState<Visit | null>(null)

  const leads = useQuery({
    queryKey: ['agent-leads', 'open', visit?.propertyId],
    queryFn: ({ signal }) =>
      leadsApi.list({ status: 'OPEN', propertyId: visit?.propertyId, page: 1 }, signal),
    enabled: visit !== null,
  })
  const lead = visit ? leads.data?.data.find((item) => item.clientId === visit.clientId) : undefined
  const lookup: LeadLookup = leads.isPending ? 'loading' : lead ? 'found' : 'missing'

  const finish = useMutation({
    mutationFn: async (input: FinishInput) => {
      await visitsApi.complete(input.visit.id, completeKey(input.visit.id))
      if (!input.lead) return
      const leadId = input.lead.id
      if (input.outcome === 'FOLLOW_UP') {
        if (input.note)
          await leadsApi.addFollowUp(leadId, input.note, noteKey({ leadId, note: input.note }))
        return
      }
      const close = { outcome: input.outcome, note: input.note }
      await leadsApi.close(leadId, close, closeKey({ leadId, ...close }))
    },
    onSuccess: () => setVisit(null),
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: ['agent-visits'] })
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] })
      if (input.lead) queryClient.invalidateQueries({ queryKey: ['lead-notes', input.lead.id] })
    },
  })

  const { reset, isPending, mutate } = finish
  const open = useCallback(
    (next: Visit) => {
      reset()
      setVisit(next)
    },
    [reset],
  )
  const close = useCallback(() => {
    if (!isPending) setVisit(null)
  }, [isPending])
  const submit = useCallback(
    (outcome: VisitOutcome, note: string | undefined) => {
      if (visit) mutate({ visit, lead, outcome, note })
    },
    [mutate, visit, lead],
  )

  return {
    visit,
    open,
    close,
    submit,
    lead: lookup,
    busy: isPending,
    error: finish.error ? errorMessage(finish.error) : undefined,
  }
}
