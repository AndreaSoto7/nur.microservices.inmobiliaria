import { memo } from 'react'
import type { CurrentUser, Role } from '../../../core/models/identity'

const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Interesado',
  AGENT: 'Agente',
  ADMIN: 'Administrador',
}

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
