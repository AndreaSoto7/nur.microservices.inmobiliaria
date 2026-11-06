import { useCallback } from 'react'
import type { PropertyTransition } from '../../../../core/models/listing'
import { PROPERTY_STATUS_LABELS } from '../../../../shared/format/property'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../../shared/ui/RowListSkeleton'
import { PropertyAdminList } from '../components/PropertyAdminList'
import { StatusFilter } from '../components/StatusFilter'
import { useAgentProperties } from '../useAgentProperties'
import { usePropertyTransition } from '../usePropertyTransition'

export function AgentPropertiesPage() {
  const { status, changeStatus, goToPage, page, loading, error, retry } = useAgentProperties()
  const { runTransition, pendingPropertyId, error: transitionError } = usePropertyTransition()

  const handleTransition = useCallback(
    (propertyId: string, transition: PropertyTransition) =>
      runTransition({ propertyId, transition }),
    [runTransition],
  )

  const total = page?.page.totalElements ?? 0

  return (
    <section className="page">
      <h1 className="account__title">Mis propiedades</h1>
      {loading ? (
        <RowListSkeleton label="Cargando tus propiedades…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar tus propiedades" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="results-bar">
            <p className="results-count" role="status">
              {total === 1 ? '1 propiedad' : `${total} propiedades`}
            </p>
            <StatusFilter value={status} onStatusChange={changeStatus} />
          </div>
          {transitionError && <ErrorMessage message={transitionError} />}
          {page && page.data.length > 0 ? (
            <>
              <PropertyAdminList
                properties={page.data}
                pendingPropertyId={pendingPropertyId}
                onTransition={handleTransition}
              />
              <Pagination
                page={page.page.number}
                totalPages={page.page.totalPages}
                onPageChange={goToPage}
              />
            </>
          ) : status ? (
            <EmptyState title={`No tienes propiedades en estado ${PROPERTY_STATUS_LABELS[status]}`}>
              Elige otro estado para ver el resto.
            </EmptyState>
          ) : (
            <EmptyState title="Todavía no tienes propiedades">
              Cuando crees una, aparecerá aquí con su estado.
            </EmptyState>
          )}
        </>
      )}
    </section>
  )
}
