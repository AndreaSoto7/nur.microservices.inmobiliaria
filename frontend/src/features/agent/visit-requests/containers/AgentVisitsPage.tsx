import { useCallback, useMemo } from 'react'
import { VISIT_STATUSES, type Visit } from '../../../../core/models/visit'
import { localInputToUtc } from '../../../../shared/format/date'
import { VISIT_STATUS_LABELS } from '../../../../shared/format/visit'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../../shared/ui/FilterSelect'
import { Pagination } from '../../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../../shared/ui/RowListSkeleton'
import { AgentAgenda } from '../components/AgentAgenda'
import { AgentVisitRow } from '../components/AgentVisitRow'
import { VisitOutcomeDialog } from '../components/VisitOutcomeDialog'
import { useAgentVisits } from '../useAgentVisits'
import { useVisitOutcome } from '../useVisitOutcome'
import { upcoming } from '../visitActions'

// Lleva a la ficha pública: el título es para ver la propiedad, no para editarla.
const propertyHref = (visit: Visit) => `/properties/${visit.propertyId}`

export function AgentVisitsPage() {
  const {
    status,
    changeStatus,
    goToPage,
    page,
    agenda,
    loading,
    error,
    retry,
    runAction,
    busyVisitId,
    failedVisitId,
    actionError,
  } = useAgentVisits()
  const outcome = useVisitOutcome()
  const now = new Date()
  const nowMinute = Math.floor(now.getTime() / 60_000)
  const next = useMemo(() => upcoming(agenda, new Date(nowMinute * 60_000)), [agenda, nowMinute])
  const showAgenda = next.length > 0 && (!status || status === 'REQUESTED')

  const handleAccept = useCallback(
    (visitId: string, proposedAt: string) =>
      runAction({ kind: 'accept', visitId, scheduledStart: proposedAt }),
    [runAction],
  )
  const handlePropose = useCallback(
    (visitId: string, localValue: string) =>
      runAction({ kind: 'propose', visitId, proposedAt: localInputToUtc(localValue) }),
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
  const { open: openOutcome } = outcome
  const handleComplete = useCallback(
    (visitId: string) => {
      const visit = page?.data.find((item) => item.id === visitId)
      if (visit) openOutcome(visit)
    },
    [page, openOutcome],
  )
  const showScheduled = useCallback(() => changeStatus('SCHEDULED'), [changeStatus])

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-heading">
          <h1>Solicitudes de visita</h1>
          <p className="page-description">
            Revisa tu agenda y acuerda los horarios con cada interesado.
          </p>
        </div>
        <FilterSelect
          label="Estado"
          value={status}
          options={VISIT_STATUSES}
          labels={VISIT_STATUS_LABELS}
          onChange={changeStatus}
        />
      </div>
      {showAgenda && <AgentAgenda visits={next} hrefFor={propertyHref} onShowAll={showScheduled} />}
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
          <ul className="row-list row-list--visits">
            {page.data.map((visit) => (
              <AgentVisitRow
                key={visit.id}
                visit={visit}
                title={visit.propertyTitle}
                href={propertyHref(visit)}
                agenda={agenda}
                now={now}
                busy={busyVisitId === visit.id}
                error={failedVisitId === visit.id ? actionError : undefined}
                onAccept={handleAccept}
                onPropose={handlePropose}
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
      {outcome.visit && (
        <VisitOutcomeDialog
          key={outcome.visit.id}
          propertyName={outcome.visit.propertyTitle ?? 'Propiedad'}
          lead={outcome.lead}
          busy={outcome.busy}
          error={outcome.error}
          onSubmit={outcome.submit}
          onClose={outcome.close}
        />
      )}
    </section>
  )
}
