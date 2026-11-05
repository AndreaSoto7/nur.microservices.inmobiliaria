import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockFetch, problem, tokens } from '../../test/http'
import { refreshSession } from './session'
import { tokenStore } from './tokenStore'

describe('refreshSession', () => {
  it('canjea el refresh token una sola vez aunque lo pidan varias llamadas a la vez', async () => {
    tokenStore.setTokens(tokens('viejo'))
    const fetchMock = mockFetch(jsonResponse(200, tokens('nuevo')))

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()])

    expect(results).toEqual([true, true, true])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(tokenStore.getAccessToken()).toBe('access-nuevo')
    expect(tokenStore.getRefreshToken()).toBe('refresh-nuevo')
  })

  it('borra la sesión si identity rechaza el refresh token', async () => {
    tokenStore.setTokens(tokens())
    mockFetch(
      jsonResponse(401, problem(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Inicia sesión de nuevo.')),
    )

    await expect(refreshSession()).resolves.toBe(false)

    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
  })

  it('conserva la sesión si el gateway responde 5xx (solo un 401 la cierra)', async () => {
    tokenStore.setTokens(tokens())
    mockFetch(jsonResponse(503, problem(503, 'GATEWAY_UNAVAILABLE', 'Servicio no disponible.')))

    await expect(refreshSession()).resolves.toBe(false)

    expect(tokenStore.getRefreshToken()).toBe('refresh-1')
  })

  it('si se cierra la sesión durante el canje, no la revive y revoca el par nuevo', async () => {
    tokenStore.setTokens(tokens('viejo'))
    let answerRefresh: (response: Response) => void = () => undefined
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (answerRefresh = resolve)))
    fetchMock.mockResolvedValueOnce(jsonResponse(204))
    vi.stubGlobal('fetch', fetchMock)

    const pending = refreshSession()
    tokenStore.clear()
    answerRefresh(jsonResponse(200, tokens('nuevo')))

    await expect(pending).resolves.toBe(false)
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8080/api/v1/auth/logout')
    expect(fetchMock.mock.calls[1][1]?.body).toBe('{"refreshToken":"refresh-nuevo"}')
  })

  it('cierra la sesión cuando otra pestaña la cierra', () => {
    tokenStore.setTokens(tokens())
    const onCleared = vi.fn()
    const unsubscribe = tokenStore.onCleared(onCleared)

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'inmobiliaria.refreshToken', newValue: null }),
    )

    expect(onCleared).toHaveBeenCalledOnce()
    expect(tokenStore.getAccessToken()).toBeNull()
    unsubscribe()
  })

  it('sin refresh token no llama a la API', async () => {
    const fetchMock = mockFetch()

    await expect(refreshSession()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
