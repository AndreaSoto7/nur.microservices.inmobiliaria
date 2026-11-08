import { memo } from 'react'
import type { CurrentUser } from '../../../core/models/identity'
import { ROLE_LABELS } from '../../../shared/format/role'

const dateFormatter = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' })

export const ProfileCard = memo(function ProfileCard({ user }: { user: CurrentUser }) {
  return (
    <dl className="card profile-card">
      <dt>Nombre</dt>
      <dd>{user.fullName}</dd>
      <dt>Email</dt>
      <dd>{user.email}</dd>
      <dt>Rol</dt>
      <dd>{user.roles.map((role) => ROLE_LABELS[role]).join(', ')}</dd>
      <dt>Miembro desde</dt>
      <dd>{dateFormatter.format(new Date(user.registeredAt))}</dd>
    </dl>
  )
})
