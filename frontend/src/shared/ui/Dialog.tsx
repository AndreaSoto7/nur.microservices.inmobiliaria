import { memo, useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  title: string
  /** Escape o el botón de volver: quien lo abre decide qué pasa. */
  onClose: () => void
  children: ReactNode
}

/**
 * Dumb: un diálogo modal con `<dialog>`. El navegador atrapa el foco, lo devuelve al cerrar y deja el
 * resto de la página inerte. Se monta abierto: para cerrarlo, quien lo usa deja de renderizarlo.
 */
export const Dialog = memo(function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    // jsdom no implementa showModal: en los tests basta con que quede abierto.
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => dialog.close?.()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      {children}
    </dialog>
  )
})
