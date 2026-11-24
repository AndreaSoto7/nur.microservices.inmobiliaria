import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../shared/ui/RowListSkeleton'
import { NotificationList } from '../components/NotificationList'
import { notificationLink } from '../notificationLink'
import { useNotificationsPage } from '../useNotifications'

export function NotificationsPage() {
  const {
    unread,
    changeUnread,
    goToPage,
    page,
    loading,
    error,
    retry,
    markRead,
    markingId,
    markError,
  } = useNotificationsPage()

  return (
    <section className="page">
      <div className="page-header">
        <h1>Avisos</h1>
        <label className="chip">
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) => changeUnread(event.target.checked)}
          />
          Solo sin leer
        </label>
      </div>
      {loading ? (
        <RowListSkeleton label="Cargando tus avisos…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar tus avisos" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          {markError && <ErrorMessage message={markError} />}
          <NotificationList
            notifications={page.data}
            linkFor={notificationLink}
            markingId={markingId}
            onMarkRead={markRead}
          />
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </>
      ) : unread ? (
        <EmptyState title="No tienes avisos sin leer">Ya revisaste todo.</EmptyState>
      ) : (
        <EmptyState title="Todavía no tienes avisos">
          Aquí vas a ver las novedades sobre tus solicitudes y propiedades.
        </EmptyState>
      )}
    </section>
  )
}
