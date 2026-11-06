/** La página viene de la URL, que se puede escribir a mano: lo inválido es la página 1. */
export function parsePageParam(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}
