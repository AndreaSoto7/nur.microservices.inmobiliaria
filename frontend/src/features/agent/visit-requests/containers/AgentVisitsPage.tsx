import { useCallback } from 'react'
import { VISIT_STATUSES } from '../../../../core/models/visit'
import { localInputToUtc } from '../../../../shared/format/date'
import { VISIT_STATUS_LABELS } from '../../../../shared/format/visit'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../../shared/ui/FilterSelect'
import { Pagination } from '../../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../../shared/ui/RowListSkeleton'
import { usePropertyTitles } from '../../../my-visits/usePropertyTitles'
import { AgentVisitRow } from '../components/AgentVisitRow'
import { useAgentVisits } from '../useAgentVisits'

export function AgentVisitsPage() {
  const {
    status,
    changeStatus,
    goToPage,
    page,
    loading,
    error,
    retry,
    runAction,
    busyVisitId,
    failedVisitId,
    actionError,
  } = useAgentVisits()
  const titles = usePropertyTitles(
    (page?.data ?? []).map((visit) => visit.propertyId),
    'agent',
  )
  const now = new Date()

  const handleSchedule = useCallback(
    (visitId: string, localValue: string) =>
      runAction({ kind: 'schedule', visitId, scheduledStart: localInputToUtc(localValue) }),
    [runAction],
  )
  const handleReject = useCallback(
    (visitId: string, reason: string) => runAction({ kind: 'reject', visitId, reason }),
    [runAction],
  )
  const handleCancel = useCallback(
    (visitId: string, reason: string | undefined) => runAction({ kind: 'cancel', visitId, reason }),
    [runAction],
  )
  const handleComplete = useCallback(
    (visitId: string) => runAction({ kind: 'complete', visitId }),
    [runAction],
  )

  return (
    <section className="page">
      <div className="page-header">
        <h1>Solicitudes de visita</h1>
        <FilterSelect
          label="Estado"
          value={status}
          options={VISIT_STATUSES}
          labels={VISIT_STATUS_LABELS}
          onChange={changeStatus}
        />
      </div>
      {loading ? (
        <RowListSkeleton label="Cargando las solicitudes…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar las solicitudes" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((visit) => (
              <AgentVisitRow
                key={visit.id}
                visit={visit}
                title={titles[visit.propertyId]}
                href={`/agente/propiedades/${visit.propertyId}`}
                now={now}
                busy={busyVisitId === visit.id}
                error={failedVisitId === visit.id ? actionError : undefined}
                onSchedule={handleSchedule}
                onReject={handleReject}
                onCancel={handleCancel}
                onComplete={handleComplete}
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
        <EmptyState title={`No tienes visitas en estado ${VISIT_STATUS_LABELS[status]}`}>
          Elige otro estado para ver el resto.
        </EmptyState>
      ) : (
        <EmptyState title="Todavía no recibiste solicitudes">
          Cuando un interesado pida visitar una de tus propiedades, aparecerá aquí.
        </EmptyState>
      )}
    </section>
  )
}
