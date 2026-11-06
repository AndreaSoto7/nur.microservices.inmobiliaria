import { memo } from 'react'
import type { Favorite, PropertySummary } from '../../../core/models/listing'
import { Button } from '../../../shared/ui/Button'
import { PropertyCard } from '../../catalog/components/PropertyCard'

interface FavoriteListProps {
  favorites: Favorite[]
  hrefFor: (property: PropertySummary) => string
  removingId: string | null
  onRemove: (propertyId: string) => void
}

/** El detalle público solo muestra estas dos: las demás responden 404 al abrirlas. */
const stillVisible = (property: PropertySummary) =>
  property.status === 'PUBLISHED' || property.status === 'RESERVED'

export const FavoriteList = memo(function FavoriteList({
  favorites,
  hrefFor,
  removingId,
  onRemove,
}: FavoriteListProps) {
  return (
    <ul className="property-grid">
      {favorites.map(({ property }) => (
        <li key={property.id} className="favorite-item">
          <PropertyCard property={property} href={hrefFor(property)} />
          <div className="favorite-item__actions">
            {!stillVisible(property) && (
              <p className="notice notice--warning">Ya no está disponible</p>
            )}
            <Button
              variant="secondary"
              disabled={removingId === property.id}
              aria-label={`Quitar de favoritos: ${property.title}`}
              onClick={() => onRemove(property.id)}
            >
              Quitar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
})
