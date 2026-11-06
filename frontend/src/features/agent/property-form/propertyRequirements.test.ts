import { describe, expect, it } from 'vitest'
import { detail } from '../../../test/listingFixtures'
import { imagesError, publishBlockers } from './propertyRequirements'

const file = (type: string, size = 1) => new File([new Uint8Array(size)], 'foto', { type })

describe('publishBlockers', () => {
  it('no hay nada que completar en una propiedad con datos y fotos', () => {
    expect(publishBlockers(detail())).toEqual([])
  })

  it('una superficie faltante bloquea aunque el resto esté', () => {
    expect(publishBlockers(detail({ areaM2: null }))).toEqual([
      'Completa dormitorios, baños y superficie.',
    ])
  })

  it('cero dormitorios es un dato válido, no un faltante', () => {
    expect(publishBlockers(detail({ bedrooms: 0 }))).toEqual([])
  })

  it('sin fotos no se puede publicar', () => {
    expect(publishBlockers(detail({ images: [] }))).toEqual(['Agrega al menos una foto.'])
  })
})

describe('imagesError', () => {
  it('acepta JPG y PNG', () => {
    expect(imagesError([file('image/jpeg'), file('image/png')], 0)).toBeUndefined()
  })

  it('rechaza otros formatos', () => {
    expect(imagesError([file('image/webp')], 0)).toMatch(/JPG o PNG/)
  })

  it('rechaza una foto de más de 5 MB', () => {
    expect(imagesError([file('image/png', 5 * 1024 * 1024 + 1)], 0)).toMatch(/5 MB/)
  })

  it('acepta una foto de exactamente 5 MB', () => {
    expect(imagesError([file('image/png', 5 * 1024 * 1024)], 0)).toBeUndefined()
  })

  it('no deja pasar del máximo contando las que ya tiene', () => {
    expect(imagesError([file('image/png'), file('image/png')], 4)).toBe(
      'Puedes agregar hasta 1 foto.',
    )
  })
})
