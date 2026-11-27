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
    remove,
    busyId,
    actionError,
  } = useNotificationsPage()

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-heading">
          <h1>Avisos</h1>
          <p className="page-description">
            Las novedades de tus consultas, visitas y propiedades, en un solo lugar.
          </p>
        </div>
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
          {actionError && <ErrorMessage message={actionError} />}
          <NotificationList
            notifications={page.data}
            linkFor={notificationLink}
            busyId={busyId}
            onMarkRead={markRead}
            onRemove={remove}
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
