import { Route, Routes } from 'react-router'
import { RequireAuth } from '../core/auth/RequireAuth'
import { AccountPage } from '../features/account/containers/AccountPage'
import { LoginPage } from '../features/auth/containers/LoginPage'
import { RegisterPage } from '../features/auth/containers/RegisterPage'
import { ErrorMessage } from '../shared/ui/ErrorMessage'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
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
          path="*"
          element={<ErrorMessage title="Página no encontrada" message="Revisa la dirección." />}
        />
      </Route>
    </Routes>
  )
}
