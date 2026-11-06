import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newIdempotencyKey, useIdempotencyKey } from './idempotency'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newIdempotencyKey', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('genera un UUID v4', () => {
    expect(newIdempotencyKey()).toMatch(UUID_V4)
  })

  it('funciona sin randomUUID, que no existe fuera de HTTPS o localhost', () => {
    const { getRandomValues } = crypto
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(crypto) })

    expect(newIdempotencyKey()).toMatch(UUID_V4)
  })
})

describe('useIdempotencyKey', () => {
  it('reintentar lo mismo reutiliza la clave', () => {
    const { result } = renderHook(() => useIdempotencyKey())

    expect(result.current({ a: 1 })).toBe(result.current({ a: 1 }))
  })

  it('cambiar el contenido usa otra clave: el servicio responde 422 si se reutiliza', () => {
    const { result } = renderHook(() => useIdempotencyKey())

    expect(result.current({ a: 1 })).not.toBe(result.current({ a: 2 }))
  })
})
