import { describe, expect, it } from 'vitest'
import type { Visit } from '../../../core/models/visit'
import { canComplete, findConflict, findConflictAt, upcoming, waitsForClient } from './visitActions'

const base: Visit = {
  id: 'pedida',
  propertyId: 'casa',
  status: 'REQUESTED',
  proposedAt: '2026-11-25T15:00:00Z',
  requestedAt: '2026-11-20T10:00:00Z',
}
const scheduled = (start: string, end: string, id = 'programada'): Visit => ({
  ...base,
  id,
  status: 'SCHEDULED',
  scheduledStart: start,
  scheduledEnd: end,
})

describe('canComplete', () => {
  it('only offers completing a scheduled visit once its slot has ended', () => {
    const visit = scheduled('2026-11-25T15:00:00Z', '2026-11-25T16:00:00Z')
    expect(canComplete(visit, new Date('2026-11-25T15:30:00Z'))).toBe(false)
    expect(canComplete(visit, new Date('2026-11-25T16:00:00Z'))).toBe(true)
    expect(canComplete(base, new Date('2026-11-26T00:00:00Z'))).toBe(false)
  })
})

describe('findConflict', () => {
  it('finds the scheduled visit that overlaps the proposed hour', () => {
    const clash = scheduled('2026-11-25T15:30:00Z', '2026-11-25T16:30:00Z')
    expect(findConflict(base, [clash])).toBe(clash)
  })

  it('allows back-to-back visits', () => {
    const before = scheduled('2026-11-25T14:00:00Z', '2026-11-25T15:00:00Z')
    const after = scheduled('2026-11-25T16:00:00Z', '2026-11-25T17:00:00Z', 'otra')
    expect(findConflict(base, [before, after])).toBeUndefined()
  })

  it('does not look for clashes once the visit is no longer pending', () => {
    const clash = scheduled('2026-11-25T15:00:00Z', '2026-11-25T16:00:00Z')
    expect(findConflict({ ...base, status: 'REJECTED' }, [clash])).toBeUndefined()
  })
})

describe('findConflictAt', () => {
  it('checks a time the agent is about to propose, ignoring the visit itself', () => {
    const own = scheduled('2026-11-25T15:00:00Z', '2026-11-25T16:00:00Z', 'pedida')
    const other = scheduled('2026-11-25T18:00:00Z', '2026-11-25T19:00:00Z', 'otra')
    expect(findConflictAt('2026-11-25T15:00:00Z', [own], 'pedida')).toBeUndefined()
    expect(findConflictAt('2026-11-25T17:30:00Z', [own, other], 'pedida')).toBe(other)
    expect(findConflictAt('no es fecha', [other])).toBeUndefined()
  })
})

describe('upcoming', () => {
  it('keeps the scheduled visits that have not ended, soonest first', () => {
    const done = scheduled('2026-11-20T15:00:00Z', '2026-11-20T16:00:00Z', 'pasada')
    const later = scheduled('2026-11-27T15:00:00Z', '2026-11-27T16:00:00Z', 'despues')
    const sooner = scheduled('2026-11-25T15:00:00Z', '2026-11-25T16:00:00Z', 'antes')
    const now = new Date('2026-11-24T12:00:00Z')
    expect(upcoming([later, done, sooner, base], now).map((visit) => visit.id)).toEqual([
      'antes',
      'despues',
    ])
  })
})

describe('waitsForClient', () => {
  it('is true only while the last proposal came from the agent', () => {
    expect(waitsForClient({ ...base, proposedBy: 'AGENT' })).toBe(true)
    expect(waitsForClient({ ...base, proposedBy: 'CLIENT' })).toBe(false)
    expect(waitsForClient({ ...base, status: 'SCHEDULED', proposedBy: 'AGENT' })).toBe(false)
  })
})
