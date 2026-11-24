import { describe, expect, it } from 'vitest'
import { keepPhoneCharacters, phoneProblem } from './phone'

describe('phone', () => {
  it('drops the letters while typing', () => {
    expect(keepPhoneCharacters('+591 7l2a3-4')).toBe('+591 723-4')
  })

  it.each(['', '+591 71234567', '71234567', '(3) 352-1234'])('accepts %s', (phone) => {
    expect(phoneProblem(phone)).toBeUndefined()
  })

  it.each([
    ['123456', 'Un teléfono tiene entre 7 y 15 dígitos.'],
    ['++591 71234567', 'Escribe solo números; puede empezar con +.'],
    ['7123-', 'Escribe solo números; puede empezar con +.'],
  ])('rejects %s', (phone, message) => {
    expect(phoneProblem(phone)).toBe(message)
  })
})
