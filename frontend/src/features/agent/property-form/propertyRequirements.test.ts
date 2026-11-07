import { describe, expect, it } from 'vitest'
import { detail } from '../../../test/listingFixtures'
import { imagesError, publishBlockers } from './propertyRequirements'

const file = (type: string, size = 1) => new File([new Uint8Array(size)], 'foto', { type })

describe('publishBlockers', () => {
  it('there is nothing to complete on a property with data and photos', () => {
    expect(publishBlockers(detail())).toEqual([])
  })

  it('a missing area blocks even if everything else is there', () => {
    expect(publishBlockers(detail({ areaM2: null }))).toEqual([
      'Completa dormitorios, baños y superficie.',
    ])
  })

  it('zero bedrooms is a valid value, not a missing one', () => {
    expect(publishBlockers(detail({ bedrooms: 0 }))).toEqual([])
  })

  it('cannot be published without photos', () => {
    expect(publishBlockers(detail({ images: [] }))).toEqual(['Agrega al menos una foto.'])
  })
})

describe('imagesError', () => {
  it('accepts JPG and PNG', () => {
    expect(imagesError([file('image/jpeg'), file('image/png')], 0)).toBeUndefined()
  })

  it('rejects other formats', () => {
    expect(imagesError([file('image/webp')], 0)).toMatch(/JPG o PNG/)
  })

  it('rejects a photo larger than 5 MB', () => {
    expect(imagesError([file('image/png', 5 * 1024 * 1024 + 1)], 0)).toMatch(/5 MB/)
  })

  it('accepts a photo of exactly 5 MB', () => {
    expect(imagesError([file('image/png', 5 * 1024 * 1024)], 0)).toBeUndefined()
  })

  it('does not allow exceeding the maximum counting the existing ones', () => {
    expect(imagesError([file('image/png'), file('image/png')], 4)).toBe(
      'Puedes agregar hasta 1 foto.',
    )
  })
})
