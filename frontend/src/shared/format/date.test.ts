import { describe, expect, it } from 'vitest'
import { formatDateTime } from './date'

describe('formatDateTime', () => {
  it('incluye el año y la hora', () => {
    const text = formatDateTime('2026-10-16T14:30:00Z')
    expect(text).toContain('2026')
    expect(text).toMatch(/\d{1,2}:\d{2}/)
  })

  it('no rompe la pantalla con una fecha inválida', () => {
    expect(formatDateTime('no-es-fecha')).toBe('')
  })
})
