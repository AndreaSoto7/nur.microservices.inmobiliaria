import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockFetch, problem, tokens } from '../../test/http'
import { tokenStore } from '../auth/tokenStore'
import { apiRequest, setRefreshHandler } from './httpClient'
import { ApiError } from './problem'

describe('apiRequest', () => {
  afterEach(() => setRefreshHandler(null))

  it('envía el body como JSON al gateway y devuelve la respuesta', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { id: 'abc' }))

    const result = await apiRequest<{ id: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'ana@example.com' },
    })

    expect(result).toEqual({ id: 'abc' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/auth/register')
    expect(init?.body).toBe('{"email":"ana@example.com"}')
  })

  it('manda el access token solo en las llamadas autenticadas', async () => {
    tokenStore.setTokens(tokens())
    const fetchMock = mockFetch(jsonResponse(200, {}), jsonResponse(200, {}))

    await apiRequest('/api/v1/users/me', { auth: true })
    await apiRequest('/api/v1/catalog/properties')

    const headersOf = (call: number) =>
      fetchMock.mock.calls[call][1]?.headers as Record<string, string>
    expect(headersOf(0).Authorization).toBe('Bearer access-1')
    expect(headersOf(1).Authorization).toBeUndefined()
  })

  it('convierte un problem+json en ApiError con su detail y code', async () => {
    mockFetch(
      jsonResponse(
        409,
        problem(409, 'USER_EMAIL_ALREADY_REGISTERED', 'El email ya está registrado.'),
      ),
    )

    const error = await apiRequest('/api/v1/auth/register', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('El email ya está registrado.')
    expect((error as ApiError).code).toBe('USER_EMAIL_ALREADY_REGISTERED')
  })

  it('con 401 en una llamada autenticada renueva la sesión y repite la llamada', async () => {
    tokenStore.setTokens(tokens('viejo'))
    const refresh = vi.fn(async () => {
      tokenStore.setTokens(tokens('nuevo'))
      return true
    })
    setRefreshHandler(refresh)
    const fetchMock = mockFetch(
      jsonResponse(401, problem(401, 'AUTH_INVALID_TOKEN', 'Vencido')),
      jsonResponse(200, { ok: true }),
    )

    const result = await apiRequest('/api/v1/users/me', { auth: true })

    expect(result).toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledOnce()
    const retryHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer access-nuevo')
  })

  it('no intenta renovar cuando el 401 es de una llamada pública (credenciales inválidas)', async () => {
    const refresh = vi.fn(async () => true)
    setRefreshHandler(refresh)
    mockFetch(
      jsonResponse(
        401,
        problem(401, 'AUTH_INVALID_CREDENTIALS', 'Email o contraseña incorrectos.'),
      ),
    )

    await expect(apiRequest('/api/v1/auth/login', { method: 'POST', body: {} })).rejects.toThrow(
      'Email o contraseña incorrectos.',
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('acepta una respuesta exitosa sin body aunque no sea 204', async () => {
    mockFetch(new Response(null, { status: 201, headers: { Location: '/api/v1/favorites/1' } }))

    await expect(apiRequest('/api/v1/favorites', { method: 'POST', body: {} })).resolves.toBe(
      undefined,
    )
  })

  it('agrega los headers propios de la llamada', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { id: 'abc' }))

    await apiRequest('/api/v1/visits', {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': 'clave-1' },
    })

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ 'Idempotency-Key': 'clave-1' })
  })

  it('manda un FormData tal cual, para que el navegador ponga el boundary del multipart', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { imageIds: ['a'] }))
    const form = new FormData()
    form.append('files', new File(['x'], 'foto.png', { type: 'image/png' }))

    await apiRequest('/api/v1/properties/1/images', { method: 'POST', body: form })

    const init = fetchMock.mock.calls[0][1]
    expect(init?.body).toBe(form)
    expect(init?.headers).not.toHaveProperty('Content-Type')
  })

  it('traduce un fallo de red a ApiError con status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiRequest('/api/v1/users/me')).rejects.toMatchObject({ status: 0 })
  })
})
