import { useCallback, useRef } from 'react'

function fromRandomBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** `randomUUID` solo existe en HTTPS o localhost, y la app también se abre por la IP de la red local. */
export function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : fromRandomBytes()
}

/**
 * Da la clave para enviar un contenido. Reintentar lo mismo reutiliza la clave, así un corte de red no
 * duplica la solicitud; cambiar el contenido usa otra, porque el servicio rechaza con 422 una clave
 * reutilizada con otro body.
 */
export function useIdempotencyKey(): (content: unknown) => string {
  const current = useRef<{ content: string; key: string } | null>(null)
  return useCallback((content: unknown) => {
    const serialized = JSON.stringify(content)
    if (current.current?.content !== serialized) {
      current.current = { content: serialized, key: newIdempotencyKey() }
    }
    return current.current.key
  }, [])
}
