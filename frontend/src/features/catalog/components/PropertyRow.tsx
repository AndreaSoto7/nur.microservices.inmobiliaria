import { memo, useState } from 'react'
import { Link } from 'react-router'
import { gatewayUrl } from '../../../core/config'
import type { PropertySummary } from '../../../core/models/listing'
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../shared/format/property'
import { HouseIcon, PinIcon } from '../../../shared/ui/icons'
import { rowId } from '../catalogView'

interface PropertyRowProps {
  property: PropertySummary
  /** A dónde lleva la fila: lo decide el container, este componente no conoce las rutas. */
  href: string
  /** Se enciende junto con su marcador del mapa. */
  active: boolean
  onActivate: (propertyId: string | null) => void
}

/** Dumb: una propiedad del catálogo en una fila (foto, zona, título, datos y precio). */
export const PropertyRow = memo(function PropertyRow({
  property,
  href,
  active,
  onActivate,
}: PropertyRowProps) {
  // Si la foto no carga, se muestra el mismo aviso que sin foto en vez de una imagen rota.
  const [imageFailed, setImageFailed] = useState(false)
  const specs = specsOf(property)

  return (
    <article
      id={rowId(property.id)}
      className={active ? 'property-row is-active' : 'property-row'}
      onMouseEnter={() => onActivate(property.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(property.id)}
      onBlur={() => onActivate(null)}
    >
      <Link to={href} className="property-row__link">
        <div className="property-row__media">
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
        <div className="property-row__body">
          <p className="property-row__zone">
            <PinIcon className="property-row__zone-icon" />
            {property.zone}
          </p>
          <h2 className="property-row__title">{property.title}</h2>
          <p className="property-row__meta">
            {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
            {OPERATION_LABELS[property.operationType].toLowerCase()}
          </p>
          {specs.length > 0 && <p className="property-row__specs">{specs.join(' · ')}</p>}
        </div>
        <p className="property-row__price">{formatPrice(property.price, property.operationType)}</p>
      </Link>
    </article>
  )
})

function specsOf(property: PropertySummary): string[] {
  return [
    property.bedrooms != null && plural(property.bedrooms, 'dormitorio', 'dormitorios'),
    property.bathrooms != null && plural(property.bathrooms, 'baño', 'baños'),
    property.areaM2 != null && `${property.areaM2} m²`,
  ].filter((spec): spec is string => Boolean(spec))
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
