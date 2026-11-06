import { NavLink, Outlet } from 'react-router'

/** Smart: el menú común de las pantallas del agente. */
export function AgentLayout() {
  return (
    <>
      <nav className="subnav" aria-label="Panel de agente">
        <NavLink to="/agente/propiedades">Mis propiedades</NavLink>
        <NavLink to="/agente/solicitudes">Solicitudes</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
