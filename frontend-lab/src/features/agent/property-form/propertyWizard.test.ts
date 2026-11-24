import { describe, expect, it } from 'vitest'
import { parseStep, stepOfField, toFeaturesRequest } from './propertyWizard'

describe('parseStep', () => {
  it('starts at the first step when the URL has none or an unknown one', () => {
    expect(parseStep(null, 4)).toBe('datos')
    expect(parseStep('cualquiera', 4)).toBe('datos')
  })

  it('does not skip ahead of the furthest step the person reached', () => {
    expect(parseStep('fotos', 4)).toBe('fotos')
    expect(parseStep('fotos', 1)).toBe('ubicacion')
  })
})

describe('stepOfField', () => {
  it('takes each API error to the step that shows the field', () => {
    expect(stepOfField('price.amount')).toBe('datos')
    expect(stepOfField('title')).toBe('datos')
    expect(stepOfField('location.zone')).toBe('ubicacion')
    expect(stepOfField('location.latitude')).toBe('ubicacion')
    expect(stepOfField('description')).toBe('detalles')
    expect(stepOfField('areaM2')).toBe('detalles')
    expect(stepOfField('otro')).toBeUndefined()
  })
})

describe('toFeaturesRequest', () => {
  it('turns the typed text into the numbers of the contract', () => {
    expect(
      toFeaturesRequest({ bedrooms: '3', bathrooms: '2', areaM2: '240.5', features: ['POOL'] }),
    ).toEqual({ bedrooms: 3, bathrooms: 2, areaM2: 240.5, features: ['POOL'] })
  })
})
