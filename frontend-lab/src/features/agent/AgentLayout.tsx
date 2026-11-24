import { NavLink, Outlet } from 'react-router'

/** Smart: el menú común de las pantallas del agente. */
export function AgentLayout() {
  return (
    <>
      <nav className="subnav" aria-label="Panel de agente">
        <NavLink to="/agent/properties">Mis propiedades</NavLink>
        <NavLink to="/agent/visit-requests">Solicitudes</NavLink>
        <NavLink to="/agent/inquiries">Consultas</NavLink>
        <NavLink to="/agent/leads">Oportunidades</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
