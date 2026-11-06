import { Link, useParams } from 'react-router'
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../shared/format/property'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../shared/ui/LoadingState'
import { FavoriteControl } from '../../favorites/containers/FavoriteControl'
import { ImageGallery } from '../components/ImageGallery'
import { PropertySpecs } from '../components/PropertySpecs'
import { usePropertyDetail } from '../usePropertyDetail'
import { PropertyContactSection } from './PropertyContactSection'

/** Smart: lee el id de la ruta y compone la galería y la ficha. */
export function PropertyDetailPage() {
  const { propertyId = '' } = useParams()
  const { property, loading, notFound, error, retry } = usePropertyDetail(propertyId)

  return (
    <section className="page page--wide">
      <Link to="/" className="back-link">
        ← Volver al catálogo
      </Link>

      {loading && <LoadingState label="Cargando la propiedad…" />}

      {notFound && (
        <EmptyState title="Esta propiedad no está disponible" titleAs="h1">
          Puede que se haya pausado, vendido o alquilado. <Link to="/">Ver otras propiedades</Link>
        </EmptyState>
      )}

      {error && (
        <div className="stack">
          <ErrorMessage title="No pudimos cargar la propiedad" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      )}

      {property && (
        <article className="detail">
          <header className="detail__header">
            <h1>{property.title}</h1>
            <p className="detail__meta">
              {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
              {OPERATION_LABELS[property.operationType].toLowerCase()} · {property.location.zone}
            </p>
          </header>
          <div className="detail__layout">
            <div className="detail__main">
              <ImageGallery images={property.images} title={property.title} />
              {property.description && (
                <section className="detail__description">
                  <h2>Descripción</h2>
                  <p>{property.description}</p>
                </section>
              )}
            </div>
            <aside className="card detail__aside" aria-label="Datos de la propiedad">
              <p className="detail__price">{formatPrice(property.price, property.operationType)}</p>
              {property.status === 'RESERVED' && (
                <p className="notice notice--warning">Reservada: no recibe visitas nuevas</p>
              )}
              <PropertySpecs property={property} />
              <FavoriteControl propertyId={property.id} propertyStatus={property.status} />
              <PropertyContactSection propertyId={property.id} propertyStatus={property.status} />
            </aside>
          </div>
        </article>
      )}
    </section>
  )
}
