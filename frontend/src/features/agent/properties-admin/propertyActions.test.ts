import { describe, expect, it } from 'vitest'
import type { OperationType, PropertyStatus } from '../../../core/models/listing'
import { availableActions } from './propertyActions'

const transitions = (status: PropertyStatus, operation: OperationType = 'SALE') =>
  availableActions(status, operation).map((action) => action.transition)

describe('availableActions', () => {
  it('un borrador solo se puede publicar', () => {
    expect(transitions('DRAFT')).toEqual(['publish'])
  })

  it('una propiedad pausada se puede volver a publicar', () => {
    expect(transitions('PAUSED')).toEqual(['publish'])
  })

  it('una propiedad en venta publicada se pausa, se reserva o se marca vendida', () => {
    expect(transitions('PUBLISHED')).toEqual(['pause', 'reserve', 'mark-sold'])
  })

  it('una propiedad en alquiler se marca alquilada, nunca vendida', () => {
    expect(transitions('PUBLISHED', 'RENT')).toEqual(['pause', 'reserve', 'mark-rented'])
  })

  it('una reserva se libera o se concreta', () => {
    expect(transitions('RESERVED', 'RENT')).toEqual(['release-reservation', 'mark-rented'])
  })

  it.each<PropertyStatus>(['SOLD', 'RENTED'])('no hay acciones desde %s', (status) => {
    expect(transitions(status)).toEqual([])
  })

  it('solo vender y alquilar son irreversibles', () => {
    const irreversible = availableActions('PUBLISHED', 'SALE').filter((a) => a.irreversible)
    expect(irreversible.map((action) => action.transition)).toEqual(['mark-sold'])
  })
})
