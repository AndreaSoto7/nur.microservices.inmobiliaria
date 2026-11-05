import { tokenStore } from '../auth/tokenStore'
import { API_BASE_URL } from '../config'
import { ApiError, isProblem } from './problem'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Manda el access token. Las rutas públicas (login, registro, catálogo) no lo necesitan. */
  auth?: boolean
  signal?: AbortSignal
}

/** Lo registra la sesión: intenta renovar los tokens y dice si lo logró. */
type RefreshHandler = () => Promise<boolean>

let refreshHandler: RefreshHandler | null = null

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler
}

/**
 * Cliente HTTP único hacia el gateway. Si una llamada autenticada responde 401 (el access token de
 * 15 min venció), renueva la sesión una vez y repite la llamada.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)
  if (response.status === 401 && options.auth && refreshHandler) {
    const refreshed = await refreshHandler()
    if (refreshed) {
      response = await send(path, options)
    }
  }
  return parse<T>(response)
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = options.auth ? tokenStore.getAccessToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, null, 'No se pudo conectar con el servidor. Revisa tu conexión.')
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Sin body o no es JSON: el mensaje genérico alcanza.
  }
  throw new ApiError(response.status, isProblem(body) ? body : null)
}
