import { memo } from 'react'
import type { PropertySummary } from '../../../core/models/listing'
import { PropertyCard } from './PropertyCard'

interface PropertyCardListProps {
  properties: PropertySummary[]
  hrefFor: (property: PropertySummary) => string
}

export const PropertyCardList = memo(function PropertyCardList({
  properties,
  hrefFor,
}: PropertyCardListProps) {
  return (
    <ul className="property-grid" aria-label="Propiedades">
      {properties.map((property) => (
        <li key={property.id}>
          <PropertyCard property={property} href={hrefFor(property)} />
        </li>
      ))}
    </ul>
  )
})
