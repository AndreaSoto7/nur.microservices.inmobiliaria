import { memo } from 'react'
import type { ReactNode } from 'react'
import { UserMenu } from './UserMenu'

interface AppHeaderProps {
  /** Nombre del usuario con sesión, o null si es anónimo. */
  userName: string | null
  loading: boolean
  onLogout: () => void
  /** Los links los pone el container: este componente no conoce el router. */
  brand: ReactNode
  links: ReactNode
  menuItems: ReactNode
}

export const AppHeader = memo(function AppHeader({
  userName,
  loading,
  onLogout,
  brand,
  links,
  menuItems,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      {brand}
      <nav aria-label="Principal" className="app-header__nav">
        {links}
        {!loading && userName && (
          <UserMenu userName={userName} onLogout={onLogout}>
            {menuItems}
          </UserMenu>
        )}
      </nav>
    </header>
  )
})
