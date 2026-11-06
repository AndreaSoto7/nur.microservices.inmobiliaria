import { describe, expect, it } from 'vitest'
import { formatDateTime, localInputToUtc, toLocalInputValue } from './date'

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

describe('fechas de un datetime-local', () => {
  it('convierte a UTC con Z, como pide la API', () => {
    expect(localInputToUtc('2099-01-15T10:30')).toMatch(/^2099-01-15T\d{2}:\d{2}:00\.000Z$/)
  })

  it('ida y vuelta conserva la fecha, sea cual sea la zona horaria', () => {
    const value = '2099-03-05T08:05'
    expect(toLocalInputValue(new Date(localInputToUtc(value)))).toBe(value)
  })
})
