import { NavLink } from 'react-router'
import { useUnreadCount } from '../useNotifications'

/** Smart: se monta solo con sesión, así que sin sesión no se consulta nada. */
export function NotificationsNavLink() {
  const count = useUnreadCount()
  return (
    <NavLink to="/avisos">
      Avisos
      {count > 0 && (
        <>
          <span className="nav-count" aria-hidden="true">
            {count}
          </span>
          <span className="visually-hidden">, {count} sin leer</span>
        </>
      )}
    </NavLink>
  )
}
