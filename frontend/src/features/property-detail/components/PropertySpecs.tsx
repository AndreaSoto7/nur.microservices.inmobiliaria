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
    <>
      <dl className="specs">
        <div>
          <dt>Tipo</dt>
          <dd>{PROPERTY_TYPE_LABELS[property.propertyType]}</dd>
        </div>
        <div>
          <dt>Operación</dt>
          <dd>{OPERATION_LABELS[property.operationType]}</dd>
        </div>
        <div>
          <dt>Zona</dt>
          <dd>
            {property.location.zone}
            {property.location.address && ` · ${property.location.address}`}
          </dd>
        </div>
        {property.bedrooms != null && (
          <div>
            <dt>Dormitorios</dt>
            <dd>{property.bedrooms}</dd>
          </div>
        )}
        {property.bathrooms != null && (
          <div>
            <dt>Baños</dt>
            <dd>{property.bathrooms}</dd>
          </div>
        )}
        {property.areaM2 != null && (
          <div>
            <dt>Superficie</dt>
            <dd>{property.areaM2} m²</dd>
          </div>
        )}
      </dl>
      {property.features.length > 0 && (
        <div className="detail__features">
          <h2>Características</h2>
          <ul className="feature-list">
            {property.features.map((feature) => (
              <li key={feature} className="chip chip--static">
                {FEATURE_LABELS[feature]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
})
