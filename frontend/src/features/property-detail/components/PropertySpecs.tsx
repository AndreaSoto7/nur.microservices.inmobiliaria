import { memo } from 'react'
import type { PropertyDetail } from '../../../core/models/listing'
import {
  FEATURE_LABELS,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../shared/format/property'

export const PropertySpecs = memo(function PropertySpecs({
  property,
}: {
  property: PropertyDetail
}) {
  return (
    <div className="card stack">
      <dl className="specs">
        <dt>Tipo</dt>
        <dd>{PROPERTY_TYPE_LABELS[property.propertyType]}</dd>
        <dt>Operación</dt>
        <dd>{OPERATION_LABELS[property.operationType]}</dd>
        <dt>Zona</dt>
        <dd>
          {property.location.zone}
          {property.location.address && ` · ${property.location.address}`}
        </dd>
        {property.bedrooms != null && (
          <>
            <dt>Dormitorios</dt>
            <dd>{property.bedrooms}</dd>
          </>
        )}
        {property.bathrooms != null && (
          <>
            <dt>Baños</dt>
            <dd>{property.bathrooms}</dd>
          </>
        )}
        {property.areaM2 != null && (
          <>
            <dt>Superficie</dt>
            <dd>{property.areaM2} m²</dd>
          </>
        )}
      </dl>
      {property.features.length > 0 && (
        <ul className="feature-list" aria-label="Características">
          {property.features.map((feature) => (
            <li key={feature} className="chip chip--static">
              {FEATURE_LABELS[feature]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
