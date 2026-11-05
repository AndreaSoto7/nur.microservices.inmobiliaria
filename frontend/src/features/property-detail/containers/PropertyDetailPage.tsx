import { Link, useParams } from 'react-router'
import { formatPrice } from '../../../shared/format/property'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../shared/ui/LoadingState'
import { ImageGallery } from '../components/ImageGallery'
import { PropertySpecs } from '../components/PropertySpecs'
import { usePropertyDetail } from '../usePropertyDetail'

/** Smart: lee el id de la ruta y compone la galería y la ficha. */
export function PropertyDetailPage() {
  const { propertyId = '' } = useParams()
  const { property, loading, notFound, error, retry } = usePropertyDetail(propertyId)

  return (
    <section className="page page--wide">
      <p>
        <Link to="/">← Volver al catálogo</Link>
      </p>

      {loading && <LoadingState label="Cargando la propiedad…" />}

      {notFound && (
        <EmptyState title="Esta propiedad no está disponible">
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
            <p className="detail__price">{formatPrice(property.price, property.operationType)}</p>
            {property.status === 'RESERVED' && (
              <p className="badge badge--inline">Reservada: no recibe visitas nuevas</p>
            )}
          </header>
          <div className="detail__layout">
            <ImageGallery images={property.images} title={property.title} />
            <PropertySpecs property={property} />
          </div>
          {property.description && <p className="detail__description">{property.description}</p>}
        </article>
      )}
    </section>
  )
}
