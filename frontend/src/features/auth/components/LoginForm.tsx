import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import type { LoginRequest } from '../../../core/models/identity'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { TextField } from '../../../shared/ui/TextField'

interface LoginFormProps {
  onSubmit: (credentials: LoginRequest) => void
  submitting: boolean
  error?: string
}

/** Dumb: solo muestra el formulario y avisa con onSubmit. No sabe de la API ni de rutas. */
export const LoginForm = memo(function LoginForm({ onSubmit, submitting, error }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ email: email.trim(), password })
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate={false}>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        maxLength={1024}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <ErrorMessage message={error} />}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
})
