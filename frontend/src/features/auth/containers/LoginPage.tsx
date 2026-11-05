import { Link, useLocation, useNavigate } from 'react-router'
import type { LoginRequest } from '../../../core/models/identity'
import { LoginForm } from '../components/LoginForm'
import { useLogin } from '../useAuthActions'

/** Smart: conecta el formulario con la sesión y decide a dónde ir después. */
export function LoginPage() {
  const { login, submitting, error } = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(credentials: LoginRequest) {
    try {
      await login(credentials)
      navigate(from, { replace: true })
    } catch {
      // El error ya queda en el estado de la mutación y lo muestra el formulario.
    }
  }

  return (
    <section className="page page--narrow">
      <h1>Ingresar</h1>
      <LoginForm onSubmit={handleSubmit} submitting={submitting} error={error} />
      <p>
        ¿No tienes cuenta? <Link to="/registro">Créala aquí</Link>
      </p>
    </section>
  )
}
