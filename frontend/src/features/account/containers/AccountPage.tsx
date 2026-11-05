import { useAuth } from '../../../core/auth/AuthContext'
import { ProfileCard } from '../components/ProfileCard'

/** Smart: la ruta ya está protegida con RequireAuth, así que aquí siempre hay usuario. */
export function AccountPage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <section className="page page--narrow">
      <h1>Mi cuenta</h1>
      <ProfileCard user={user} />
    </section>
  )
}
