import { memo, useState, type FormEvent } from 'react'
import { ROLES, type Role } from '../../../core/models/identity'
import { ROLE_LABELS } from '../../../shared/format/role'
import { Button } from '../../../shared/ui/Button'

interface RolesFormProps {
  name: string
  roles: Role[]
  /** Un administrador no se quita su propio rol. Quien lo hace cumplir es identity. */
  adminLocked: boolean
  busy: boolean
  onSubmit: (roles: Role[]) => void
  onCancel: () => void
}

/** Dumb: elegir los roles de una cuenta. */
export const RolesForm = memo(function RolesForm({
  name,
  roles,
  adminLocked,
  busy,
  onSubmit,
  onCancel,
}: RolesFormProps) {
  const [selected, setSelected] = useState<Role[]>(roles)
  const unchanged =
    selected.length === roles.length && selected.every((role) => roles.includes(role))

  const toggle = (role: Role) =>
    setSelected((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(ROLES.filter((role) => selected.includes(role)))
  }

  return (
    <form className="confirm-bar" onSubmit={submit}>
      <fieldset className="field">
        <legend>Roles de {name}</legend>
        {ROLES.map((role) => (
          <label key={role} className="chip">
            <input
              type="checkbox"
              checked={selected.includes(role)}
              disabled={role === 'ADMIN' && adminLocked}
              onChange={() => toggle(role)}
            />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </fieldset>
      {selected.length === 0 && <p>Elige al menos un rol.</p>}
      <p>Se aplica cuando la persona renueva su sesión, en 15 minutos como máximo.</p>
      <div className="action-bar">
        <Button type="submit" disabled={busy || unchanged || selected.length === 0}>
          Guardar roles
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
      </div>
    </form>
  )
})
