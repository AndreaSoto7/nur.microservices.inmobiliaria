import { setRefreshHandler } from '../api/httpClient'
import { ApiError } from '../api/problem'
import { authApi } from './authApi'
import { tokenStore } from './tokenStore'

const CROSS_TAB_LOCK = 'inmobiliaria.refresh'

let refreshInFlight: Promise<boolean> | null = null

/**
 * Canjea el refresh token por un par nuevo. El contrato de identity pide serializar los canjes: el
 * refresh token sirve una sola vez y no hay período de gracia, así que canjear dos veces el mismo
 * token revoca la sesión entera.
 * - Dentro de la pestaña es single-flight: varias llamadas con 401 (o StrictMode) esperan el mismo canje.
 * - Entre pestañas, un Web Lock: el token se relee adentro, por si otra pestaña ya lo rotó.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= withCrossTabLock(doRefresh).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function doRefresh(): Promise<boolean> {
  const generation = tokenStore.generation()
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) return false
  try {
    const pair = await authApi.refresh(refreshToken)
    if (tokenStore.generation() !== generation) {
      // Se cerró la sesión mientras canjeábamos: revocar el par nuevo en vez de revivirla.
      await authApi.logout(pair.refreshToken).catch(() => undefined)
      return false
    }
    tokenStore.setTokens(pair)
    return true
  } catch (error) {
    // Solo un 401 cierra la sesión (contrato). Con 5xx, 429 o sin red se conserva para reintentar.
    if (error instanceof ApiError && error.status === 401) tokenStore.clear()
    return false
  }
}

function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(CROSS_TAB_LOCK, task)
  }
  return task()
}

setRefreshHandler(refreshSession)
