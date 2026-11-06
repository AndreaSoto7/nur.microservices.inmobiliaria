import { Link, Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../core/auth/RequireAuth'
import { AccountPage } from '../features/account/containers/AccountPage'
import { AgentInquiriesPage } from '../features/agent/inquiries/containers/AgentInquiriesPage'
import { AgentLayout } from '../features/agent/AgentLayout'
import { AgentPropertiesPage } from '../features/agent/properties-admin/containers/AgentPropertiesPage'
import { PropertyCreatePage } from '../features/agent/property-form/containers/PropertyCreatePage'
import { PropertyEditPage } from '../features/agent/property-form/containers/PropertyEditPage'
import { AgentVisitsPage } from '../features/agent/visit-requests/containers/AgentVisitsPage'
import { CatalogPage } from '../features/catalog/containers/CatalogPage'
import { FavoritesPage } from '../features/favorites/containers/FavoritesPage'
import { LoginPage } from '../features/auth/containers/LoginPage'
import { RegisterPage } from '../features/auth/containers/RegisterPage'
import { MyVisitsPage } from '../features/my-visits/containers/MyVisitsPage'
import { NotificationsPage } from '../features/notifications/containers/NotificationsPage'
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
          path="avisos"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="mis-visitas"
          element={
            <RequireAuth roles={['CLIENT']}>
              <MyVisitsPage />
            </RequireAuth>
          }
        />
        <Route
          path="favoritos"
          element={
            <RequireAuth roles={['CLIENT', 'AGENT']}>
              <FavoritesPage />
            </RequireAuth>
          }
        />
        <Route
          path="agente"
          element={
            <RequireAuth roles={['AGENT']}>
              <AgentLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="propiedades" replace />} />
          <Route path="propiedades" element={<AgentPropertiesPage />} />
          <Route path="propiedades/nueva" element={<PropertyCreatePage />} />
          <Route path="propiedades/:propertyId" element={<PropertyEditPage />} />
          <Route path="solicitudes" element={<AgentVisitsPage />} />
          <Route path="consultas" element={<AgentInquiriesPage />} />
        </Route>
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
