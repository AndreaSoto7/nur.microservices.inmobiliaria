import { memo } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../shared/ui/Button'

interface AppHeaderProps {
  /** Nombre del usuario con sesión, o null si es anónimo. */
  userName: string | null
  loading: boolean
  onLogout: () => void
  /** Los links los pone el container: este componente no conoce el router. */
  brand: ReactNode
  links: ReactNode
}

export const AppHeader = memo(function AppHeader({
  userName,
  loading,
  onLogout,
  brand,
  links,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">{brand}</div>
      <nav aria-label="Principal" className="app-header__nav">
        {links}
        {!loading && userName && (
          <>
            <span className="app-header__user">Hola, {userName}</span>
            <Button variant="secondary" onClick={onLogout}>
              Cerrar sesión
            </Button>
          </>
        )}
      </nav>
    </header>
  )
})
