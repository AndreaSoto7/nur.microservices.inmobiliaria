import { useCallback, useMemo, useState } from 'react'
import type { PropertySummary } from '../../../core/models/listing'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { ListIcon, MapIcon } from '../../../shared/ui/icons'
import { Pagination } from '../../../shared/ui/Pagination'
import { hasActiveFilters, type CatalogSort } from '../catalogFilters'
import { countWithoutLocation, rowId, zonesOf } from '../catalogView'
import { CatalogMap } from '../components/CatalogMap'
import { PropertyFilters } from '../components/PropertyFilters'
import { PropertyRowList } from '../components/PropertyRowList'
import { PropertyRowsSkeleton } from '../components/PropertyRowsSkeleton'
import { SortSelect } from '../components/SortSelect'
import { ZoneChips } from '../components/ZoneChips'
import { useCatalog } from '../useCatalog'

type CatalogView = 'list' | 'map'

const NO_PROPERTIES: PropertySummary[] = []

/**
 * Smart: une la URL, el facade del catálogo, la lista y el mapa. La fila y el marcador activos son
 * estado de UI de esta pantalla. En el celular, un botón cambia entre la lista y el mapa.
 */
export function CatalogPage() {
  const { filters, applyFilters, goToPage, page, loading, refreshing, error, retry } = useCatalog()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<CatalogView>('list')
  const properties = page?.data ?? NO_PROPERTIES
  const zones = useMemo(() => zonesOf(properties), [properties])
  const unlocated = useMemo(() => countWithoutLocation(properties), [properties])

  const hrefFor = useCallback((property: PropertySummary) => `/properties/${property.id}`, [])
  const handleSortChange = useCallback(
    (sort: CatalogSort) => applyFilters({ ...filters, sort }),
    [applyFilters, filters],
  )
  const pickZone = useCallback(
    (zone: string) => applyFilters({ ...filters, zone }),
    [applyFilters, filters],
  )
  const clearZone = useCallback(
    () => applyFilters({ ...filters, zone: undefined }),
    [applyFilters, filters],
  )
  // Tocar un marcador lleva su fila a la vista (en el celular la lista está oculta y no hace falta).
  const selectFromMap = useCallback((propertyId: string) => {
    setActiveId(propertyId)
    document.getElementById(rowId(propertyId))?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <section className="catalog" data-view={view}>
      <div className="catalog__search">
        <PropertyFilters value={filters} onFiltersChange={applyFilters} />
      </div>

      <div className="catalog__split">
        <div className="catalog__list">
          <header className="catalog__intro">
            <h1>Encuentra tu próxima casa o departamento</h1>
            <p className="catalog__lead">
              Propiedades en venta y alquiler, publicadas por agentes.
            </p>
          </header>

          {loading && <PropertyRowsSkeleton label="Buscando propiedades…" />}

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
              <ZoneChips
                zones={zones}
                activeZone={filters.zone}
                onPick={pickZone}
                onClear={clearZone}
              />
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
              {unlocated > 0 && (
                <p className="catalog__note">
                  {unlocated === 1
                    ? '1 propiedad no aparece en el mapa: el agente no marcó su ubicación.'
                    : `${unlocated} propiedades no aparecen en el mapa: el agente no marcó su ubicación.`}
                </p>
              )}
              {page.data.length > 0 ? (
                <PropertyRowList
                  properties={page.data}
                  hrefFor={hrefFor}
                  activeId={activeId}
                  onActivate={setActiveId}
                />
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

        <div className="catalog__map" id="catalog-map">
          <CatalogMap
            properties={properties}
            hrefFor={hrefFor}
            activeId={activeId}
            onActivate={setActiveId}
            onSelect={selectFromMap}
          />
        </div>
      </div>

      <button
        type="button"
        className="catalog__view-toggle"
        aria-controls="catalog-map"
        onClick={() => setView((current) => (current === 'list' ? 'map' : 'list'))}
      >
        {view === 'list' ? (
          <>
            <MapIcon className="catalog__view-icon" />
            Ver mapa
          </>
        ) : (
          <>
            <ListIcon className="catalog__view-icon" />
            Ver lista
          </>
        )}
      </button>
    </section>
  )
}
