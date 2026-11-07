import { describe, expect, it } from 'vitest'
import { formatDateTime, localInputToUtc, toLocalInputValue } from './date'

describe('formatDateTime', () => {
  it('includes the year and the time', () => {
    const text = formatDateTime('2026-10-16T14:30:00Z')
    expect(text).toContain('2026')
    expect(text).toMatch(/\d{1,2}:\d{2}/)
  })

  it('does not break the screen with an invalid date', () => {
    expect(formatDateTime('no-es-fecha')).toBe('')
  })
})

describe('datetime-local dates', () => {
  it('converts to UTC with Z, as the API requires', () => {
    expect(localInputToUtc('2099-01-15T10:30')).toMatch(/^2099-01-15T\d{2}:\d{2}:00\.000Z$/)
  })

  it('round trip keeps the date, whatever the time zone', () => {
    const value = '2099-03-05T08:05'
    expect(toLocalInputValue(new Date(localInputToUtc(value)))).toBe(value)
  })
})
