import { useCallback } from 'react'
import { Link } from 'react-router'
import { VISIT_STATUSES } from '../../../core/models/visit'
import { localInputToUtc } from '../../../shared/format/date'
import { VISIT_STATUS_LABELS } from '../../../shared/format/visit'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../shared/ui/FilterSelect'
import { Pagination } from '../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../shared/ui/RowListSkeleton'
import { MyVisitRow } from '../components/MyVisitRow'
import { useMyVisits } from '../useMyVisits'

export function MyVisitsPage() {
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
  } = useMyVisits()
  const now = new Date()

  const handleCancel = useCallback(
    (visitId: string, reason: string | undefined) => runAction({ kind: 'cancel', visitId, reason }),
    [runAction],
  )
  const handleAccept = useCallback(
    (visitId: string) => runAction({ kind: 'accept', visitId }),
    [runAction],
  )
  const handlePropose = useCallback(
    (visitId: string, localValue: string) =>
      runAction({ kind: 'propose', visitId, proposedAt: localInputToUtc(localValue) }),
    [runAction],
  )

  return (
    <section className="page">
      <div className="page-header">
        <h1>Mis visitas</h1>
        <FilterSelect
          label="Estado"
          value={status}
          options={VISIT_STATUSES}
          labels={VISIT_STATUS_LABELS}
          onChange={changeStatus}
        />
      </div>
      {loading ? (
        <RowListSkeleton label="Cargando tus visitas…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar tus visitas" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((visit) => (
              <MyVisitRow
                key={visit.id}
                visit={visit}
                title={visit.propertyTitle}
                href={`/properties/${visit.propertyId}`}
                now={now}
                busy={busyVisitId === visit.id}
                error={failedVisitId === visit.id ? actionError : undefined}
                onCancel={handleCancel}
                onAccept={handleAccept}
                onPropose={handlePropose}
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
        <EmptyState title="Todavía no solicitaste visitas">
          Solicítalas desde la ficha de una propiedad. <Link to="/">Ver el catálogo</Link>
        </EmptyState>
      )}
    </section>
  )
}
