import { vi } from 'vitest'
import type { Problem } from '../core/api/problem'
import type { CurrentUser, TokenPair } from '../core/models/identity'

export function jsonResponse(status: number, body?: unknown): Response {
  if (body === undefined) return new Response(null, { status })
  const contentType = status >= 400 ? 'application/problem+json' : 'application/json'
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

export function problem(status: number, code: string, detail: string): Problem {
  return { type: `https://inmobiliaria.local/problems/${code}`, title: code, status, code, detail }
}

/** Reemplaza fetch por un mock que responde en orden. */
export function mockFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>()
  for (const response of responses) fn.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fn)
  return fn
}

type RouteHandler = (init?: RequestInit) => Response

/**
 * Reemplaza fetch por un mock que responde según `MÉTODO /ruta`, sin importar el orden: sirve cuando
 * una pantalla vuelve a consultar después de una acción. Una ruta sin mock responde 501.
 */
export function routeFetch(routes: Record<string, RouteHandler>) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`
    const handler = routes[key]
    return handler ? handler(init) : jsonResponse(501, problem(501, 'NO_MOCK', key))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** Cuerpos JSON que recibió una ruta, en orden. */
export function sentBodies(fn: ReturnType<typeof routeFetch>, method: string, path: string) {
  return fn.mock.calls
    .filter(([url, init]) => init?.method === method && new URL(String(url)).pathname === path)
    .map(([, init]) => JSON.parse(String(init?.body ?? 'null')) as unknown)
}

/** Deja la sesión lista para recuperarse al montar la app, con el usuario indicado. */
export function sessionRoutes(user: CurrentUser): Record<string, RouteHandler> {
  localStorage.setItem('inmobiliaria.refreshToken', 'refresh-guardado')
  return {
    'POST /api/v1/auth/refresh': () => jsonResponse(200, tokens('nuevo')),
    'GET /api/v1/users/me': () => jsonResponse(200, user),
  }
}

export const tokens = (suffix = '1'): TokenPair => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  tokenType: 'Bearer',
  expiresIn: 900,
})

export const currentUser: CurrentUser = {
  id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  email: 'ana@example.com',
  fullName: 'Ana Pérez',
  roles: ['CLIENT'],
  registeredAt: '2026-10-16T14:30:00Z',
}

export const agentUser: CurrentUser = { ...currentUser, fullName: 'Carla Agente', roles: ['AGENT'] }
