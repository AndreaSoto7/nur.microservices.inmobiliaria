import { describe, expect, it } from 'vitest'
import { visit } from '../../../test/visitFixtures'
import { canComplete } from './visitActions'

const NOW = new Date('2026-10-16T15:00:00Z')

describe('canComplete', () => {
  it('se puede justo al terminar el horario', () => {
    expect(
      canComplete(visit({ status: 'SCHEDULED', scheduledEnd: '2026-10-16T15:00:00Z' }), NOW),
    ).toBe(true)
  })

  it('no se puede antes de que termine', () => {
    expect(
      canComplete(visit({ status: 'SCHEDULED', scheduledEnd: '2026-10-16T15:00:01Z' }), NOW),
    ).toBe(false)
  })

  it('solo aplica a una visita programada', () => {
    expect(
      canComplete(visit({ status: 'COMPLETED', scheduledEnd: '2026-10-16T14:00:00Z' }), NOW),
    ).toBe(false)
  })
})
