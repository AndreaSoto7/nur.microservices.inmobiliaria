import { NavLink, Outlet } from 'react-router'
import { HouseIcon } from '../../shared/ui/icons'
import { CalendarIcon, MessageIcon, OpportunityIcon } from '../../shared/ui/management-icons'

/** Smart: el menú común de las pantallas del agente. */
export function AgentLayout() {
  return (
    <>
      <nav className="subnav" aria-label="Panel de agente">
        <NavLink to="/agent/properties">
          <HouseIcon className="subnav__icon" />
          Mis propiedades
        </NavLink>
        <NavLink to="/agent/visit-requests">
          <CalendarIcon className="subnav__icon" />
          Solicitudes
        </NavLink>
        <NavLink to="/agent/inquiries">
          <MessageIcon className="subnav__icon" />
          Consultas
        </NavLink>
        <NavLink to="/agent/leads">
          <OpportunityIcon className="subnav__icon" />
          Oportunidades
        </NavLink>
      </nav>
      <Outlet />
    </>
  )
}
