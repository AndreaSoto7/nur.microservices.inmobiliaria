import { useCallback } from 'react'
import { Link } from 'react-router'
import { VISIT_STATUSES } from '../../../core/models/visit'
import { VISIT_STATUS_LABELS } from '../../../shared/format/visit'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../shared/ui/FilterSelect'
import { Pagination } from '../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../shared/ui/RowListSkeleton'
import { MyVisitRow } from '../components/MyVisitRow'
import { useMyVisits } from '../useMyVisits'
import { usePropertyTitles } from '../usePropertyTitles'

export function MyVisitsPage() {
  const {
    status,
    changeStatus,
    goToPage,
    page,
    loading,
    error,
    retry,
    cancelVisit,
    cancellingId,
    cancelError,
  } = useMyVisits()
  const titles = usePropertyTitles(
    (page?.data ?? []).map((visit) => visit.propertyId),
    'catalog',
  )

  const handleCancel = useCallback(
    (visitId: string, reason: string | undefined) => cancelVisit({ visitId, reason }),
    [cancelVisit],
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
          {cancelError && <ErrorMessage message={cancelError} />}
          <ul className="row-list">
            {page.data.map((visit) => (
              <MyVisitRow
                key={visit.id}
                visit={visit}
                title={titles[visit.propertyId]}
                href={`/properties/${visit.propertyId}`}
                cancelling={cancellingId === visit.id}
                onCancel={handleCancel}
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
