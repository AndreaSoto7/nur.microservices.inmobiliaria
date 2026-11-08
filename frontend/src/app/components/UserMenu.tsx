import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon } from '../../shared/ui/icons'

interface UserMenuProps {
  userName: string
  /** Los enlaces los pone el container: este componente no conoce el router. */
  children: ReactNode
  onLogout: () => void
}

/** Dumb: botón con el nombre del usuario que despliega sus opciones. */
export const UserMenu = memo(function UserMenu({ userName, children, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeIfOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="user-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="button button--secondary user-menu__trigger"
        aria-label={`Menú de ${userName}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="user-menu__name">{userName}</span>
        <ChevronDownIcon className="user-menu__chevron" />
      </button>
      {open && (
        <div className="user-menu__panel" onClick={() => setOpen(false)}>
          {children}
          <button type="button" className="user-menu__logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
})
