import { Link, useNavigate } from 'react-router'
import type { RegisterUserRequest } from '../../../core/models/identity'
import { RegisterForm } from '../components/RegisterForm'
import { useRegister } from '../useAuthActions'

export function RegisterPage() {
  const { register, submitting, error, fieldErrors } = useRegister()
  const navigate = useNavigate()

  async function handleSubmit(request: RegisterUserRequest) {
    try {
      await register(request)
      navigate('/', { replace: true })
    } catch {
      // El error ya queda en el estado de la mutación y lo muestra el formulario.
    }
  }

  return (
    <section className="page page--narrow">
      <div className="card auth-card">
        <h1>Crear cuenta</h1>
        <p className="auth-card__lead">Para buscar propiedades o publicar las tuyas.</p>
        <RegisterForm
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          fieldErrors={fieldErrors}
        />
        <p className="auth-card__footer">
          ¿Ya tienes cuenta? <Link to="/login">Ingresa</Link>
        </p>
      </div>
    </section>
  )
}
