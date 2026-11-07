import { describe, expect, it } from 'vitest'
import { visit } from '../../../test/visitFixtures'
import { canComplete } from './visitActions'

const NOW = new Date('2026-10-16T15:00:00Z')

describe('canComplete', () => {
  it('is allowed right when the slot ends', () => {
    expect(
      canComplete(visit({ status: 'SCHEDULED', scheduledEnd: '2026-10-16T15:00:00Z' }), NOW),
    ).toBe(true)
  })

  it('is not allowed before it ends', () => {
    expect(
      canComplete(visit({ status: 'SCHEDULED', scheduledEnd: '2026-10-16T15:00:01Z' }), NOW),
    ).toBe(false)
  })

  it('only applies to a scheduled visit', () => {
    expect(
      canComplete(visit({ status: 'COMPLETED', scheduledEnd: '2026-10-16T14:00:00Z' }), NOW),
    ).toBe(false)
  })
})
