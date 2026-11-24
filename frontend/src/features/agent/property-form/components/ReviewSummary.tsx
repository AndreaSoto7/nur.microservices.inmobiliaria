import { memo } from 'react'
import type { PropertyDetail } from '../../../../core/models/listing'
import {
  FEATURE_LABELS,
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../../shared/format/property'
import { MAX_IMAGES } from '../propertyRequirements'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Dumb: el resumen de lo guardado, antes de publicar. */
export const ReviewSummary = memo(function ReviewSummary({
  property,
}: {
  property: PropertyDetail
}) {
  const { location } = property
  const rooms =
    property.bedrooms == null || property.bathrooms == null || property.areaM2 == null
      ? 'Sin completar'
      : `${plural(property.bedrooms, 'dormitorio', 'dormitorios')} · ${plural(property.bathrooms, 'baño', 'baños')} · ${property.areaM2} m²`
  return (
    <dl className="specs review-summary">
      <dt>Propiedad</dt>
      <dd>
        {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
        {OPERATION_LABELS[property.operationType].toLowerCase()}
      </dd>
      <dt>Título</dt>
      <dd>{property.title}</dd>
      <dt>Precio</dt>
      <dd>{formatPrice(property.price, property.operationType)}</dd>
      <dt>Ubicación</dt>
      <dd>{[location.zone, location.address].filter(Boolean).join(', ')}</dd>
      <dt>Ambientes</dt>
      <dd>{rooms}</dd>
      <dt>Extras</dt>
      <dd>
        {property.features.length > 0
          ? property.features.map((feature) => FEATURE_LABELS[feature]).join(', ')
          : 'Ninguno'}
      </dd>
      <dt>Fotos</dt>
      <dd>
        {property.images.length} de {MAX_IMAGES}
      </dd>
    </dl>
  )
})
