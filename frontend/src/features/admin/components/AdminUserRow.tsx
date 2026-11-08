import { memo, useState } from 'react'
import type { AdminUser, Role } from '../../../core/models/identity'
import { formatDateTime } from '../../../shared/format/date'
import { ROLE_LABELS } from '../../../shared/format/role'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { RolesForm } from './RolesForm'

interface AdminUserRowProps {
  user: AdminUser
  /** La cuenta de quien está mirando: no se puede desactivar ni quitarse el rol. */
  isSelf: boolean
  busy: boolean
  error?: string
  onAssignRoles: (userId: string, roles: Role[]) => void
  onDeactivate: (userId: string) => void
  onActivate: (userId: string) => void
}

/** Dumb: una cuenta y lo que el administrador puede hacer con ella. */
export const AdminUserRow = memo(function AdminUserRow({
  user,
  isSelf,
  busy,
  error,
  onAssignRoles,
  onDeactivate,
  onActivate,
}: AdminUserRowProps) {
  const [panel, setPanel] = useState<'roles' | 'deactivate' | null>(null)
  const name = user.fullName

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <h2 className="row-card__title">
          {name}
          {isSelf && ' (tú)'}
        </h2>
        <StatusBadge
          label={user.active ? 'Activa' : 'Desactivada'}
          tone={user.active ? 'success' : 'neutral'}
        />
      </div>
      <dl className="specs">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Roles</dt>
        <dd>{user.roles.map((role) => ROLE_LABELS[role]).join(', ')}</dd>
        <dt>Registro</dt>
        <dd>{formatDateTime(user.registeredAt)}</dd>
      </dl>
      {error && <ErrorMessage message={error} />}
      {panel === 'roles' && (
        <RolesForm
          name={name}
          roles={user.roles}
          adminLocked={isSelf}
          busy={busy}
          onSubmit={(roles) => onAssignRoles(user.id, roles)}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'deactivate' && (
        <div className="confirm-bar">
          <p>
            {name} ya no podrá iniciar sesión. Si tiene una sesión abierta, puede seguir usando los
            demás servicios hasta 15 minutos.
          </p>
          <div className="action-bar">
            <Button disabled={busy} onClick={() => onDeactivate(user.id)}>
              Sí, desactivar
            </Button>
            <Button variant="secondary" onClick={() => setPanel(null)}>
              Volver
            </Button>
          </div>
        </div>
      )}
      {panel === null && (
        <div className="action-bar">
          <Button
            variant="secondary"
            disabled={busy}
            aria-label={`Cambiar roles: ${name}`}
            onClick={() => setPanel('roles')}
          >
            Cambiar roles
          </Button>
          {user.active
            ? !isSelf && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Desactivar: ${name}`}
                  onClick={() => setPanel('deactivate')}
                >
                  Desactivar
                </Button>
              )
            : !isSelf && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Activar: ${name}`}
                  onClick={() => onActivate(user.id)}
                >
                  Activar
                </Button>
              )}
        </div>
      )}
    </li>
  )
})
