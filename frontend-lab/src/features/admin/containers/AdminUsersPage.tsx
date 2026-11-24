import { useCallback } from 'react'
import { useAuth } from '../../../core/auth/AuthContext'
import { ROLES, type Role } from '../../../core/models/identity'
import { ROLE_LABELS } from '../../../shared/format/role'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { FilterSelect } from '../../../shared/ui/FilterSelect'
import { Pagination } from '../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../shared/ui/RowListSkeleton'
import { AdminUserRow } from '../components/AdminUserRow'
import { useAdminUsers } from '../useAdminUsers'

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const {
    role,
    changeRole,
    goToPage,
    page,
    loading,
    error,
    retry,
    runAction,
    busyUserId,
    failedUserId,
    actionError,
  } = useAdminUsers()

  const handleAssignRoles = useCallback(
    (userId: string, roles: Role[]) => runAction({ kind: 'roles', userId, roles }),
    [runAction],
  )
  const handleDeactivate = useCallback(
    (userId: string) => runAction({ kind: 'deactivate', userId }),
    [runAction],
  )
  const handleActivate = useCallback(
    (userId: string) => runAction({ kind: 'activate', userId }),
    [runAction],
  )

  return (
    <section className="page">
      <div className="page-header">
        <h1>Usuarios</h1>
        <FilterSelect
          label="Rol"
          value={role}
          options={ROLES}
          labels={ROLE_LABELS}
          onChange={changeRole}
        />
      </div>
      {loading ? (
        <RowListSkeleton label="Cargando los usuarios…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar los usuarios" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((user) => (
              <AdminUserRow
                // La clave incluye lo que se puede cambiar: al guardar, la fila se reinicia y el
                // panel se cierra. Si falla, nada cambia y el panel sigue abierto para corregir.
                key={`${user.id}:${user.roles.join()}:${user.active}`}
                user={user}
                isSelf={user.id === currentUser?.id}
                busy={busyUserId === user.id}
                error={failedUserId === user.id ? actionError : undefined}
                onAssignRoles={handleAssignRoles}
                onDeactivate={handleDeactivate}
                onActivate={handleActivate}
              />
            ))}
          </ul>
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </>
      ) : (
        <EmptyState title="No hay usuarios con ese rol">
          Elige otro rol para ver el resto.
        </EmptyState>
      )}
    </section>
  )
}
