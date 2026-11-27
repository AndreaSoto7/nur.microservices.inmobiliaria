import { memo } from 'react'
import { Link } from 'react-router'
import type { PropertySummary, PropertyTransition } from '../../../../core/models/listing'
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../../shared/format/property'
import { PropertyActions } from './PropertyActions'
import { PropertyStatusBadge } from './PropertyStatusBadge'
import { PropertyCover } from './PropertyCover'
import type { PropertyCoverSource } from '../usePropertyCovers'

interface PropertyAdminListProps {
  properties: PropertySummary[]
  covers: Record<string, PropertyCoverSource>
  /** A dónde lleva cada fila: lo decide el container. */
  hrefFor: (property: PropertySummary) => string
  pendingPropertyId: string | null
  onTransition: (propertyId: string, transition: PropertyTransition) => void
}

export const PropertyAdminList = memo(function PropertyAdminList({
  properties,
  covers,
  hrefFor,
  pendingPropertyId,
  onTransition,
}: PropertyAdminListProps) {
  return (
    <ul className="row-list property-admin-list">
      {properties.map((property) => (
        <li key={property.id} className="card property-admin-row">
          <PropertyCover
            title={property.title}
            loading={covers[property.id]?.loading ?? false}
            src={covers[property.id]?.src}
          />
          <div className="property-admin__body">
            <div className="property-admin__identity">
              <p className="property-admin__zone">{property.zone}</p>
              <PropertyStatusBadge status={property.status} />
            </div>
            <div className="property-admin__description">
              <h2 className="row-card__title">
                <Link to={hrefFor(property)}>{property.title}</Link>
              </h2>
              <p className="row-card__meta">
                {PROPERTY_TYPE_LABELS[property.propertyType]} en{' '}
                {OPERATION_LABELS[property.operationType].toLowerCase()}
              </p>
              <p className="property-admin__specs">
                {[
                  property.bedrooms != null && `${property.bedrooms} dorm.`,
                  property.bathrooms != null &&
                    `${property.bathrooms} ${property.bathrooms === 1 ? 'baño' : 'baños'}`,
                  property.areaM2 != null && `${property.areaM2} m²`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="row-card__price">
                {formatPrice(property.price, property.operationType)}
              </p>
            </div>
          </div>
          <div className="property-admin__controls">
            <Link
              to={hrefFor(property)}
              className="button button--secondary property-admin__edit"
              aria-label={`${property.status === 'SOLD' || property.status === 'RENTED' ? 'Consultar' : 'Editar'}: ${property.title}`}
            >
              {property.status === 'DRAFT'
                ? 'Completar propiedad'
                : property.status === 'SOLD' || property.status === 'RENTED'
                  ? 'Consultar propiedad'
                  : 'Editar propiedad'}
            </Link>
            <PropertyActions
              title={property.title}
              status={property.status}
              operationType={property.operationType}
              busy={pendingPropertyId === property.id}
              onRun={(transition) => onTransition(property.id, transition)}
            />
          </div>
        </li>
      ))}
    </ul>
  )
})
