import { Link } from 'react-router'
import type { PropertySummary } from '../../../core/models/listing'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../shared/ui/Pagination'
import { PropertyGridSkeleton } from '../../catalog/components/PropertyGridSkeleton'
import { FavoriteList } from '../components/FavoriteList'
import { useFavoritesPage } from '../useFavorites'

const detailHref = (property: PropertySummary) => `/properties/${property.id}`

export function FavoritesPage() {
  const { page, loading, error, retry, goToPage, removeFavorite, removingId, removeError } =
    useFavoritesPage()

  return (
    <section className="page page--wide">
      <h1 className="account__title">Favoritos</h1>
      {loading ? (
        <PropertyGridSkeleton label="Cargando tus favoritos…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar tus favoritos" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <div className="stack stack--full">
          {removeError && <ErrorMessage message={removeError} />}
          <FavoriteList
            favorites={page.data}
            hrefFor={detailHref}
            removingId={removingId}
            onRemove={removeFavorite}
          />
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </div>
      ) : (
        <EmptyState title="Todavía no tienes favoritos">
          Guarda desde su ficha las propiedades que te interesen.{' '}
          <Link to="/">Ver el catálogo</Link>
        </EmptyState>
      )}
    </section>
  )
}
