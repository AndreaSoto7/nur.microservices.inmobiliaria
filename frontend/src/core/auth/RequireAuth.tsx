import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ErrorMessage } from '../../shared/ui/ErrorMessage'
import { LoadingState } from '../../shared/ui/LoadingState'
import type { Role } from '../models/identity'
import { useAuth } from './AuthContext'

interface RequireAuthProps {
  /** Si se indica, el usuario debe tener al menos uno de estos roles. */
  roles?: Role[]
  children: ReactNode
}

/**
 * Ruta protegida. Es solo una comodidad de UI: la autorización real la hace cada servicio con el JWT.
 */
export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { status, hasRole } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState label="Recuperando tu sesión…" />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (roles && !roles.some(hasRole)) {
    return <ErrorMessage title="Sin permiso" message="Tu cuenta no tiene acceso a esta sección." />
  }
  return children
}
