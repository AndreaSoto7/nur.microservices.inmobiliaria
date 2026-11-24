import { describe, expect, it } from 'vitest'
import type { OperationType, PropertyStatus } from '../../../core/models/listing'
import { availableActions } from './propertyActions'

const transitions = (status: PropertyStatus, operation: OperationType = 'SALE') =>
  availableActions(status, operation).map((action) => action.transition)

describe('availableActions', () => {
  it('a draft can only be published', () => {
    expect(transitions('DRAFT')).toEqual(['publish'])
  })

  it('a paused property can be published again', () => {
    expect(transitions('PAUSED')).toEqual(['publish'])
  })

  it('a published property for sale can be paused, reserved or marked sold', () => {
    expect(transitions('PUBLISHED')).toEqual(['pause', 'reserve', 'mark-sold'])
  })

  it('a property for rent is marked rented, never sold', () => {
    expect(transitions('PUBLISHED', 'RENT')).toEqual(['pause', 'reserve', 'mark-rented'])
  })

  it('a reservation is released or completed', () => {
    expect(transitions('RESERVED', 'RENT')).toEqual(['release-reservation', 'mark-rented'])
  })

  it.each<PropertyStatus>(['SOLD', 'RENTED'])('there are no actions from %s', (status) => {
    expect(transitions(status)).toEqual([])
  })

  it('only selling and renting are irreversible', () => {
    const irreversible = availableActions('PUBLISHED', 'SALE').filter((a) => a.irreversible)
    expect(irreversible.map((action) => action.transition)).toEqual(['mark-sold'])
  })
})
