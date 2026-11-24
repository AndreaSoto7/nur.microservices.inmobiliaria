import { memo, useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { RegisterUserRequest, RegistrableRole } from '../../../core/models/identity'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { TextField } from '../../../shared/ui/TextField'

interface RegisterFormProps {
  onSubmit: (request: RegisterUserRequest) => void
  submitting: boolean
  error?: string
  /** Errores por campo que devolvió la API (problem+json `errors`). */
  fieldErrors?: Partial<Record<keyof RegisterUserRequest, string>>
}

const ROLE_OPTIONS: { value: RegistrableRole; label: string }[] = [
  { value: 'CLIENT', label: 'Busco una propiedad' },
  { value: 'AGENT', label: 'Soy agente y publico propiedades' },
]

export const RegisterForm = memo(function RegisterForm({
  onSubmit,
  submitting,
  error,
  fieldErrors = {},
}: RegisterFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<RegistrableRole>('CLIENT')
  const roleGroupId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ fullName: fullName.trim(), email: email.trim(), password, role })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <TextField
        label="Nombre completo"
        autoComplete="name"
        required
        maxLength={150}
        value={fullName}
        error={fieldErrors.fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        error={fieldErrors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Contraseña (8 a 128 caracteres)"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        value={password}
        error={fieldErrors.password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <fieldset
        className="field"
        aria-describedby={fieldErrors.role ? `${roleGroupId}-error` : undefined}
      >
        <legend>¿Cómo vas a usar la plataforma?</legend>
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="radio">
            <input
              type="radio"
              name={roleGroupId}
              value={option.value}
              checked={role === option.value}
              onChange={() => setRole(option.value)}
            />
            {option.label}
          </label>
        ))}
        {fieldErrors.role && (
          <span id={`${roleGroupId}-error`} className="field__error">
            {fieldErrors.role}
          </span>
        )}
      </fieldset>
      {error && <ErrorMessage message={error} />}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  )
})
