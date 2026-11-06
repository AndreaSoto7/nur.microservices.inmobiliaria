import { memo } from 'react'
import type { PropertySummary, PropertyTransition } from '../../../../core/models/listing'
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../../shared/format/property'
import { PropertyActions } from './PropertyActions'
import { PropertyStatusBadge } from './PropertyStatusBadge'

interface PropertyAdminListProps {
  properties: PropertySummary[]
  pendingPropertyId: string | null
  onTransition: (propertyId: string, transition: PropertyTransition) => void
}

export const PropertyAdminList = memo(function PropertyAdminList({
  properties,
  pendingPropertyId,
  onTransition,
}: PropertyAdminListProps) {
  return (
    <ul className="row-list">
      {properties.map((property) => (
        <li key={property.id} className="card row-card">
          <div className="row-card__head">
            <div>
              <h2 className="row-card__title">{property.title}</h2>
              <p className="row-card__meta">
                {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
                {OPERATION_LABELS[property.operationType].toLowerCase()} · {property.zone}
              </p>
              <p className="row-card__price">
                {formatPrice(property.price, property.operationType)}
              </p>
            </div>
            <PropertyStatusBadge status={property.status} />
          </div>
          <PropertyActions
            title={property.title}
            status={property.status}
            operationType={property.operationType}
            busy={pendingPropertyId === property.id}
            onRun={(transition) => onTransition(property.id, transition)}
          />
        </li>
      ))}
    </ul>
  )
})
