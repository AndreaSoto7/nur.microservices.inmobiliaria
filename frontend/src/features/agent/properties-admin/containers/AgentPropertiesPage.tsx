import { useCallback } from 'react'
import { Link } from 'react-router'
import type { PropertySummary, PropertyTransition } from '../../../../core/models/listing'
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

const editHref = (property: PropertySummary) => `/agente/propiedades/${property.id}`

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
      <div className="page-header">
        <h1>Mis propiedades</h1>
        <Link to="/agente/propiedades/nueva" className="button button--primary">
          Nueva propiedad
        </Link>
      </div>
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
                hrefFor={editHref}
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
              Crea un borrador, agrégale fotos y publícalo cuando esté listo.
            </EmptyState>
          )}
        </>
      )}
    </section>
  )
}
