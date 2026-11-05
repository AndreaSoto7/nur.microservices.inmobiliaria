import { useCallback } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../core/auth/AuthContext'
import { AppHeader } from './components/AppHeader'

/** Smart: arma la cabecera según la sesión y maneja el cierre de sesión. */
export function AppLayout() {
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [logout, navigate])

  const links =
    status === 'authenticated' ? (
      <NavLink to="/cuenta">Mi cuenta</NavLink>
    ) : status === 'anonymous' ? (
      <>
        <NavLink to="/login">Ingresar</NavLink>
        <NavLink to="/registro">Crear cuenta</NavLink>
      </>
    ) : null

  return (
    <>
      <AppHeader
        brand={<Link to="/">Plataforma Inmobiliaria</Link>}
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
