import { memo } from 'react'
import type { PropertySummary } from '../../../core/models/listing'
import { PropertyRow } from './PropertyRow'

interface PropertyRowListProps {
  properties: PropertySummary[]
  hrefFor: (property: PropertySummary) => string
  activeId: string | null
  onActivate: (propertyId: string | null) => void
}

export const PropertyRowList = memo(function PropertyRowList({
  properties,
  hrefFor,
  activeId,
  onActivate,
}: PropertyRowListProps) {
  return (
    <ul className="property-rows" aria-label="Propiedades">
      {properties.map((property) => (
        <li key={property.id}>
          <PropertyRow
            property={property}
            href={hrefFor(property)}
            active={property.id === activeId}
            onActivate={onActivate}
          />
        </li>
      ))}
    </ul>
  )
})
