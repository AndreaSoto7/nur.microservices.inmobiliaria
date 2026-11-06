import { Link, Route, Routes } from 'react-router'
import { RequireAuth } from '../core/auth/RequireAuth'
import { AccountPage } from '../features/account/containers/AccountPage'
import { AgentPropertiesPage } from '../features/agent/properties-admin/containers/AgentPropertiesPage'
import { CatalogPage } from '../features/catalog/containers/CatalogPage'
import { LoginPage } from '../features/auth/containers/LoginPage'
import { RegisterPage } from '../features/auth/containers/RegisterPage'
import { PropertyDetailPage } from '../features/property-detail/containers/PropertyDetailPage'
import { EmptyState } from '../shared/ui/EmptyState'
import { AppLayout } from './AppLayout'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="propiedades/:propertyId" element={<PropertyDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="registro" element={<RegisterPage />} />
        <Route
          path="cuenta"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="agente/propiedades"
          element={
            <RequireAuth roles={['AGENT']}>
              <AgentPropertiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <section className="page page--narrow">
              <EmptyState title="Página no encontrada" titleAs="h1">
                Revisa la dirección o <Link to="/">vuelve al catálogo</Link>.
              </EmptyState>
            </section>
          }
        />
      </Route>
    </Routes>
  )
}
