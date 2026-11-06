import { Link, useLocation } from 'react-router'
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
  const { status, hasRole } = useAuth()
  const location = useLocation()
  const canSave = hasRole('CLIENT') || hasRole('AGENT')
  const { saved, ready, busy, error, toggle } = useFavoriteToggle(propertyId, canSave)

  if (status === 'anonymous') {
    return (
      <Link to="/login" state={{ from: location.pathname }}>
        Ingresa para guardarla
      </Link>
    )
  }
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
