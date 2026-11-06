import { useAuth } from '../../../core/auth/AuthContext'
import type { PropertyStatus } from '../../../core/models/listing'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { FavoriteToggle } from '../components/FavoriteToggle'
import { useFavoriteToggle } from '../useFavorites'

interface FavoriteControlProps {
  propertyId: string
  propertyStatus: PropertyStatus
}

/** Smart: decide qué ofrecer según la sesión, el rol y si la propiedad se puede guardar. */
export function FavoriteControl({ propertyId, propertyStatus }: FavoriteControlProps) {
  const { hasRole } = useAuth()
  const canSave = hasRole('CLIENT') || hasRole('AGENT')
  const { saved, ready, busy, error, toggle } = useFavoriteToggle(propertyId, canSave)

  if (!canSave || !ready) return null
  // Solo se guarda lo publicado (contrato), pero quitar se puede en cualquier estado.
  if (!saved && propertyStatus !== 'PUBLISHED') return null

  return (
    <div className="favorite-control">
      <FavoriteToggle saved={saved} busy={busy} onToggle={toggle} />
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
