import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newIdempotencyKey, useIdempotencyKey } from './idempotency'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newIdempotencyKey', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('generates a v4 UUID', () => {
    expect(newIdempotencyKey()).toMatch(UUID_V4)
  })

  it('works without randomUUID, which does not exist outside HTTPS or localhost', () => {
    const { getRandomValues } = crypto
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(crypto) })

    expect(newIdempotencyKey()).toMatch(UUID_V4)
  })
})

describe('useIdempotencyKey', () => {
  it('retrying the same request reuses the key', () => {
    const { result } = renderHook(() => useIdempotencyKey())

    expect(result.current({ a: 1 })).toBe(result.current({ a: 1 }))
  })

  it('changing the content uses another key: the service responds 422 if it is reused', () => {
    const { result } = renderHook(() => useIdempotencyKey())

    expect(result.current({ a: 1 })).not.toBe(result.current({ a: 2 }))
  })
})
