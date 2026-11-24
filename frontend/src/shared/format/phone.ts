/** Las mismas reglas que visit (contracts/openapi/visit-service.yaml): dígitos con + inicial opcional. */
const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]*[0-9]$/
const MIN_DIGITS = 7
const MAX_DIGITS = 15

export const PHONE_MAX_LENGTH = 20

/** Lo que se puede escribir en un teléfono: el resto de los caracteres se descarta al tipear. */
export function keepPhoneCharacters(value: string): string {
  return value.replace(/[^0-9+()\s-]/g, '')
}

/** El problema de un teléfono, o undefined si está bien (o vacío: es opcional). */
export function phoneProblem(value: string): string | undefined {
  const phone = value.trim()
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '').length
  if (!PHONE_PATTERN.test(phone)) return 'Escribe solo números; puede empezar con +.'
  if (digits < MIN_DIGITS || digits > MAX_DIGITS) {
    return `Un teléfono tiene entre ${MIN_DIGITS} y ${MAX_DIGITS} dígitos.`
  }
  return undefined
}
