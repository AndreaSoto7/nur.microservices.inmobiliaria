import { useCallback } from 'react'
import type { PropertySummary } from '../../../core/models/listing'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../shared/ui/Pagination'
import { hasActiveFilters, type CatalogSort } from '../catalogFilters'
import { PropertyCardList } from '../components/PropertyCardList'
import { PropertyFilters } from '../components/PropertyFilters'
import { PropertyGridSkeleton } from '../components/PropertyGridSkeleton'
import { SortSelect } from '../components/SortSelect'
import { useCatalog } from '../useCatalog'

/** Smart: une la URL, el facade del catálogo y los componentes. Maneja loading, error, empty y success. */
export function CatalogPage() {
  const { filters, filtersKey, applyFilters, goToPage, page, loading, refreshing, error, retry } =
    useCatalog()
  const hrefFor = useCallback((property: PropertySummary) => `/properties/${property.id}`, [])
  const handleSortChange = useCallback(
    (sort: CatalogSort) => applyFilters({ ...filters, sort }),
    [applyFilters, filters],
  )

  return (
    <section>
      <div className="catalog__hero">
        <div className="page page--wide catalog__hero-inner">
          <h1>Encuentra tu próxima casa o departamento</h1>
          <p className="catalog__lead">Propiedades en venta y alquiler, publicadas por agentes.</p>
          <PropertyFilters key={filtersKey} value={filters} onFiltersChange={applyFilters} />
        </div>
      </div>

      <div className="page page--wide">
        {loading && <PropertyGridSkeleton label="Buscando propiedades…" />}

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
            <div className="results-bar">
              <p className="results-count" role="status">
                {page.page.totalElements === 1
                  ? '1 propiedad'
                  : `${page.page.totalElements} propiedades`}
              </p>
              {page.data.length > 0 && (
                <SortSelect value={filters.sort} onSortChange={handleSortChange} />
              )}
            </div>
            {page.data.length > 0 ? (
              <PropertyCardList properties={page.data} hrefFor={hrefFor} />
            ) : hasActiveFilters(filters) ? (
              <EmptyState title="No hay propiedades con esos filtros">
                Prueba con otra zona o quita alguna característica.
              </EmptyState>
            ) : (
              <EmptyState title="Todavía no hay propiedades publicadas">
                Cuando un agente publique una, la vas a ver aquí.
              </EmptyState>
            )}
            <Pagination
              page={page.page.number}
              totalPages={page.page.totalPages}
              onPageChange={goToPage}
            />
          </div>
        )}
      </div>
    </section>
  )
}
