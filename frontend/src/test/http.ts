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
