import type { TokenPair } from '../models/identity'

/**
 * Dónde viven los tokens.
 * - El access token (15 min), solo en memoria de cada pestaña.
 * - El refresh token, en localStorage. Tiene que ser compartido: identity no da período de gracia,
 *   así que si dos pestañas guardaran copias propias, la segunda en canjear reutilizaría un token
 *   ya usado y se revocaría la sesión entera. Con un solo lugar, cada canje (serializado en
 *   session.ts) usa siempre el último token. identity lo entrega en el body (no hay cookie
 *   httpOnly): cualquier storage es legible por un XSS, por eso la CSP del servidor es pendiente.
 */
const REFRESH_TOKEN_KEY = 'inmobiliaria.refreshToken'

type Listener = () => void

let accessToken: string | null = null
/** Sube con cada cierre de sesión: un canje que empezó antes no debe revivir la sesión. */
let generation = 0
const listeners = new Set<Listener>()

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(REFRESH_TOKEN_KEY)
    else localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } catch {
    // Storage bloqueado (modo privado estricto): la sesión dura lo que dure la página.
  }
}

function endSession(): void {
  const hadSession = accessToken !== null
  accessToken = null
  generation += 1
  if (hadSession) listeners.forEach((listener) => listener())
}

// Si otra pestaña cierra la sesión, esta también la cierra.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === REFRESH_TOKEN_KEY && event.newValue === null) endSession()
  })
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken
  },

  getRefreshToken(): string | null {
    return readRefreshToken()
  },

  generation(): number {
    return generation
  },

  setTokens(pair: TokenPair): void {
    accessToken = pair.accessToken
    writeRefreshToken(pair.refreshToken)
  },

  /** Borra todo y avisa, para que la UI se entere si la sesión se cae a mitad de una llamada. */
  clear(): void {
    writeRefreshToken(null)
    endSession()
  },

  onCleared(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
