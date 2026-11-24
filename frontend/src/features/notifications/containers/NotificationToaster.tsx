import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { NotificationToast } from '../components/NotificationToast'
import { toastFor, unannounced, type ToastContent } from '../notificationToast'
import { useLatestUnread } from '../useNotifications'

const VISIBLE_MS = 6_000
const LEAVE_MS = 200

/** Hasta qué aviso ya se anunció, por usuario y en este navegador: al recargar no se repite. */
const markerKey = (userId: string) => `inmobiliaria.notifications.announcedUpTo.${userId}`

function readMarker(userId: string): string | null {
  try {
    return localStorage.getItem(markerKey(userId))
  } catch {
    return null
  }
}

function writeMarker(userId: string, value: string) {
  try {
    localStorage.setItem(markerKey(userId), value)
  } catch {
    // Sin almacenamiento (modo privado): a lo sumo se repite un anuncio al recargar.
  }
}

/**
 * Smart: cuando la consulta periódica de avisos trae alguno sin leer que todavía no se anunció, lo
 * anuncia con un mensaje que baja desde arriba. En la página de avisos no anuncia nada: ya se están viendo.
 */
export function NotificationToaster({ userId }: { userId: string }) {
  const { data } = useLatestUnread()
  const { pathname } = useLocation()
  const [announcedUpTo, setAnnouncedUpTo] = useState(() => readMarker(userId))
  const [seen, setSeen] = useState<typeof data>()
  const [toast, setToast] = useState<ToastContent | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [holding, setHolding] = useState(false)
  const leaveTimer = useRef<number | undefined>(undefined)

  // Cada respuesta nueva de la consulta se revisa una vez, durante el render (sin efectos encadenados).
  if (data && data !== seen) {
    setSeen(data)
    const fresh = unannounced(data.data, announcedUpTo)
    if (fresh.length > 0) {
      setAnnouncedUpTo(fresh[0].createdAt)
      if (pathname !== '/notifications') {
        // Si todos los que trajo la consulta son nuevos, puede haber más: se usa el total sin leer.
        const count = fresh.length === data.data.length ? data.page.totalElements : fresh.length
        setToast(toastFor(fresh, count))
        setLeaving(false)
      }
    }
  }

  useEffect(() => {
    if (announcedUpTo) writeMarker(userId, announcedUpTo)
  }, [userId, announcedUpTo])

  const close = useCallback(() => {
    setLeaving(true)
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setToast(null)
      setLeaving(false)
    }, LEAVE_MS)
  }, [])

  useEffect(() => {
    if (!toast || holding) return
    const timer = window.setTimeout(close, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [toast, holding, close])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <NotificationToast
          key={toast.id}
          toast={toast}
          leaving={leaving}
          onClose={close}
          onHold={setHolding}
        />
      )}
    </div>
  )
}
