import { useCallback } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../core/auth/AuthContext'
import { NotificationsNavLink } from '../features/notifications/containers/NotificationsNavLink'
import { HouseIcon } from '../shared/ui/icons'
import { AppHeader } from './components/AppHeader'

/** Smart: arma la cabecera según la sesión y maneja el cierre de sesión. */
export function AppLayout() {
  const { status, user, logout, hasRole } = useAuth()
  const navigate = useNavigate()

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [logout, navigate])

  const links =
    status === 'authenticated' ? (
      <>
        {hasRole('AGENT') && <NavLink to="/agente">Panel de agente</NavLink>}
        {hasRole('CLIENT') && <NavLink to="/mis-visitas">Mis visitas</NavLink>}
        {(hasRole('CLIENT') || hasRole('AGENT')) && <NavLink to="/favoritos">Favoritos</NavLink>}
        <NotificationsNavLink />
        <NavLink to="/cuenta">Mi cuenta</NavLink>
      </>
    ) : status === 'anonymous' ? (
      <>
        <NavLink to="/login">Ingresar</NavLink>
        <NavLink to="/registro" className="button button--primary">
          Crear cuenta
        </NavLink>
      </>
    ) : null

  return (
    <>
      <AppHeader
        brand={
          <Link to="/" className="brand">
            <HouseIcon className="brand__icon" />
            Plataforma Inmobiliaria
          </Link>
        }
        links={links}
        userName={user?.fullName ?? null}
        loading={status === 'loading'}
        onLogout={handleLogout}
      />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}
