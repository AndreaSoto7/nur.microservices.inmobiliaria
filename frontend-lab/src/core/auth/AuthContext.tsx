import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CurrentUser, LoginRequest, Role } from '../models/identity'
import { authApi } from './authApi'
import { refreshSession } from './session'
import { tokenStore } from './tokenStore'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: CurrentUser | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  hasRole: (role: Role) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Estado de la sesión para toda la app. Al cargar la página intenta recuperar la sesión con el
 * refresh token guardado; si identity lo rechaza, el usuario queda anónimo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const queryClient = useQueryClient()

  const loadCurrentUser = useCallback(async () => {
    const current = await authApi.getCurrentUser()
    setUser(current)
    setStatus('authenticated')
  }, [])

  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then(async (restored) => {
        if (!restored) throw new Error('sin sesión')
        const current = await authApi.getCurrentUser()
        if (!cancelled) {
          setUser(current)
          setStatus('authenticated')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // La sesión se cae (logout, refresh rechazado u otra pestaña cerró sesión): la UI vuelve a anónimo
  // y se borra la caché de datos, para que el próximo usuario no vea los del anterior.
  useEffect(
    () =>
      tokenStore.onCleared(() => {
        queryClient.clear()
        setUser(null)
        setStatus('anonymous')
      }),
    [queryClient],
  )

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const pair = await authApi.login(credentials)
      tokenStore.setTokens(pair)
      try {
        await loadCurrentUser()
      } catch (error) {
        // Sin perfil no hay sesión usable: no dejar tokens vivos guardados.
        tokenStore.clear()
        await authApi.logout(pair.refreshToken).catch(() => undefined)
        throw error
      }
    },
    [loadCurrentUser],
  )

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken()
    tokenStore.clear()
    if (refreshToken) {
      // El contrato pide borrar los tokens locales pase lo que pase: un fallo aquí no importa.
      await authApi.logout(refreshToken).catch(() => undefined)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      hasRole: (role) => user?.roles.includes(role) ?? false,
    }),
    [status, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth se usa dentro de <AuthProvider>')
  return context
}
