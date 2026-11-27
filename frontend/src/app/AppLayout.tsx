import { useCallback } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../core/auth/AuthContext'
import { NotificationToaster } from '../features/notifications/containers/NotificationToaster'
import { NotificationsNavLink } from '../features/notifications/containers/NotificationsNavLink'
import { HouseIcon } from '../shared/ui/icons'
import { AppHeader } from './components/AppHeader'
import { AccountNavigation } from './components/AccountNavigation'
import { RouteScroll } from './components/RouteScroll'

/** Smart: arma la cabecera según la sesión y maneja el cierre de sesión. */
export function AppLayout() {
  const { status, user, logout, hasRole } = useAuth()
  const navigate = useNavigate()

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [logout, navigate])

  const links = (
    <>
      <NavLink to="/" end>
        Inicio
      </NavLink>
      {status === 'authenticated' && (
        <>
          {hasRole('ADMIN') && <NavLink to="/admin/users">Usuarios</NavLink>}
          {hasRole('AGENT') && <NavLink to="/agent">Panel de agente</NavLink>}
          {hasRole('CLIENT') && <NavLink to="/my-visits">Mis visitas</NavLink>}
          <NotificationsNavLink />
        </>
      )}
      {status === 'anonymous' && (
        <>
          <NavLink to="/login">Ingresar</NavLink>
          <NavLink to="/register" className="button button--primary">
            Crear cuenta
          </NavLink>
        </>
      )}
    </>
  )

  const menuItems = (
    <>
      {hasRole('CLIENT') && <NavLink to="/my-inquiries">Mis consultas</NavLink>}
      {(hasRole('CLIENT') || hasRole('AGENT')) && <NavLink to="/favorites">Favoritos</NavLink>}
    </>
  )

  return (
    <>
      <RouteScroll />
      <AppHeader
        brand={
          <Link to="/" className="brand">
            <HouseIcon className="brand__icon" />
            Plataforma Inmobiliaria
          </Link>
        }
        links={links}
        menuItems={menuItems}
        userName={user?.fullName ?? null}
        userEmail={user?.email}
        loading={status === 'loading'}
        onLogout={handleLogout}
      />
      {status === 'authenticated' && user && <NotificationToaster userId={user.id} />}
      <main id="main-content" className="app-main" tabIndex={-1}>
        <AccountNavigation />
        <Outlet />
      </main>
    </>
  )
}
