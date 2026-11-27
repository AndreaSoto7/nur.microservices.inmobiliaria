import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext'

const ACCOUNT_PATHS = ['/my-visits', '/my-inquiries', '/favorites', '/notifications']

/** Hace visibles las secciones del interesado sin modificar sus rutas ni permisos. */
export function AccountNavigation() {
  const { hasRole } = useAuth()
  const { pathname } = useLocation()
  if (!hasRole('CLIENT') || !ACCOUNT_PATHS.includes(pathname)) return null
  return (
    <nav className="subnav subnav--account" aria-label="Mi actividad">
      <NavLink to="/my-visits">Visitas</NavLink>
      <NavLink to="/my-inquiries">Consultas</NavLink>
      <NavLink to="/favorites">Favoritos</NavLink>
      <NavLink to="/notifications">Avisos</NavLink>
    </nav>
  )
}
