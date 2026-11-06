import { useCallback } from 'react'
import { LEAD_STATUSES, type LeadOutcome } from '../../../../core/models/visit'
import { LEAD_STATUS_LABELS } from '../../../../shared/format/lead'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../../shared/ui/FilterSelect'
import { Pagination } from '../../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../../shared/ui/RowListSkeleton'
import { usePropertyTitles } from '../../../my-visits/usePropertyTitles'
import { LeadRow } from '../components/LeadRow'
import { useAgentLeads } from '../useAgentLeads'

export function AgentLeadsPage() {
  const {
    status,
    changeStatus,
    goToPage,
    page,
    loading,
    error,
    retry,
    runAction,
    busyLeadId,
    failedLeadId,
    actionError,
    noteSavedLeadId,
    reservingLeadId,
  } = useAgentLeads()
  const titles = usePropertyTitles(
    (page?.data ?? []).map((lead) => lead.propertyId),
    'agent',
  )

  const handleAddNote = useCallback(
    (leadId: string, note: string, onDone: () => void) =>
      runAction({ kind: 'note', leadId, note }, { onSuccess: onDone }),
    [runAction],
  )
  const handleClose = useCallback(
    (leadId: string, outcome: LeadOutcome, note: string | undefined) =>
      runAction({ kind: 'close', leadId, outcome, note }),
    [runAction],
  )

  return (
    <section className="page">
      <div className="page-header">
        <h1>Oportunidades</h1>
        <FilterSelect
          label="Estado"
          value={status}
          options={LEAD_STATUSES}
          labels={LEAD_STATUS_LABELS}
          onChange={changeStatus}
        />
      </div>
      {loading ? (
        <RowListSkeleton label="Cargando las oportunidades…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar las oportunidades" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                title={titles[lead.propertyId]}
                href={`/agente/propiedades/${lead.propertyId}`}
                busy={busyLeadId === lead.id}
                error={failedLeadId === lead.id ? actionError : undefined}
                noteSaved={noteSavedLeadId === lead.id}
                reserving={reservingLeadId === lead.id}
                onAddNote={handleAddNote}
                onClose={handleClose}
              />
            ))}
          </ul>
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </>
      ) : status ? (
        <EmptyState title={`No tienes oportunidades en estado ${LEAD_STATUS_LABELS[status]}`}>
          Elige otro estado para ver el resto.
        </EmptyState>
      ) : (
        <EmptyState title="Todavía no tienes oportunidades">
          Se abre una cuando un interesado consulta por una de tus propiedades o pide visitarla.
        </EmptyState>
      )}
    </section>
  )
}
