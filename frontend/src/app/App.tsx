import { Link, Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../core/auth/RequireAuth'
import { AccountPage } from '../features/account/containers/AccountPage'
import { AdminUsersPage } from '../features/admin/containers/AdminUsersPage'
import { AgentInquiriesPage } from '../features/agent/inquiries/containers/AgentInquiriesPage'
import { AgentLeadsPage } from '../features/agent/lead-follow-up/containers/AgentLeadsPage'
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
        <Route path="properties/:propertyId" element={<PropertyDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="my-visits"
          element={
            <RequireAuth roles={['CLIENT']}>
              <MyVisitsPage />
            </RequireAuth>
          }
        />
        <Route
          path="favorites"
          element={
            <RequireAuth roles={['CLIENT', 'AGENT']}>
              <FavoritesPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAuth roles={['ADMIN']}>
              <AdminUsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="agent"
          element={
            <RequireAuth roles={['AGENT']}>
              <AgentLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="properties" replace />} />
          <Route path="properties" element={<AgentPropertiesPage />} />
          <Route path="properties/new" element={<PropertyCreatePage />} />
          <Route path="properties/:propertyId" element={<PropertyEditPage />} />
          <Route path="visit-requests" element={<AgentVisitsPage />} />
          <Route path="inquiries" element={<AgentInquiriesPage />} />
          <Route path="leads" element={<AgentLeadsPage />} />
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
