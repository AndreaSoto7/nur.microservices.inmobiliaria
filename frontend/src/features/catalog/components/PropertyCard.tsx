import { memo, useState } from 'react'
import { Link } from 'react-router'
import { gatewayUrl } from '../../../core/config'
import type { PropertySummary } from '../../../core/models/listing'
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../shared/format/property'
import { HouseIcon } from '../../../shared/ui/icons'

interface PropertyCardProps {
  property: PropertySummary
  /** A dónde lleva la tarjeta: lo decide el container, este componente no conoce las rutas. */
  href: string
}

export const PropertyCard = memo(function PropertyCard({ property, href }: PropertyCardProps) {
  // Si la foto no carga, se muestra el mismo aviso que sin foto en vez de una imagen rota.
  const [imageFailed, setImageFailed] = useState(false)
  const specs = [
    property.bedrooms != null && plural(property.bedrooms, 'dormitorio', 'dormitorios'),
    property.bathrooms != null && plural(property.bathrooms, 'baño', 'baños'),
    property.areaM2 != null && `${property.areaM2} m²`,
  ].filter(Boolean)

  return (
    <article className="property-card card">
      <Link to={href} className="property-card__link">
        <div className="property-card__media">
          {property.coverImageUrl && !imageFailed ? (
            <img
              src={gatewayUrl(property.coverImageUrl)}
              alt={property.title}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="media-placeholder" aria-hidden="true">
              <HouseIcon className="media-placeholder__icon" />
              Sin foto
            </div>
          )}
          {property.status === 'RESERVED' && <span className="badge">Reservada</span>}
        </div>
        <div className="property-card__body">
          <p className="property-card__price">
            {formatPrice(property.price, property.operationType)}
          </p>
          <h2 className="property-card__title">{property.title}</h2>
          <p className="property-card__meta">
            {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
            {OPERATION_LABELS[property.operationType].toLowerCase()} · {property.zone}
          </p>
          {specs.length > 0 && <p className="property-card__specs">{specs.join(' · ')}</p>}
        </div>
      </Link>
    </article>
  )
})

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
