import { useCallback } from 'react'
import type { PropertySummary } from '../../../core/models/listing'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../shared/ui/LoadingState'
import { Pagination } from '../../../shared/ui/Pagination'
import { PropertyCardList } from '../components/PropertyCardList'
import { PropertyFilters } from '../components/PropertyFilters'
import { useCatalog } from '../useCatalog'

/** Smart: une la URL, el facade del catálogo y los componentes. Maneja loading, error, empty y success. */
export function CatalogPage() {
  const { filters, filtersKey, applyFilters, goToPage, page, loading, refreshing, error, retry } =
    useCatalog()
  const hrefFor = useCallback((property: PropertySummary) => `/propiedades/${property.id}`, [])

  return (
    <section className="page page--wide">
      <h1>Encuentra tu próxima casa o departamento</h1>
      <PropertyFilters key={filtersKey} value={filters} onFiltersChange={applyFilters} />

      {loading && <LoadingState label="Buscando propiedades…" />}

      {error && (
        <div className="stack">
          <ErrorMessage title="No pudimos cargar el catálogo" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      )}

      {page && !error && (
        <div aria-busy={refreshing}>
          <p className="results-count" role="status">
            {page.page.totalElements === 1
              ? '1 propiedad'
              : `${page.page.totalElements} propiedades`}
          </p>
          {page.data.length === 0 ? (
            <EmptyState title="No hay propiedades con esos filtros">
              Prueba con otra zona o quita alguna característica.
            </EmptyState>
          ) : (
            <PropertyCardList properties={page.data} hrefFor={hrefFor} />
          )}
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}
    </section>
  )
}
