const dateTime = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })

/** La API manda UTC (ISO-8601); se muestra en la hora local de quien mira. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateTime.format(date)
}

/** Lo que escribe un `datetime-local` (hora local, sin zona) en el UTC que pide la API. */
export function localInputToUtc(value: string): string {
  return new Date(value).toISOString()
}

/** Valor para un `datetime-local`, en hora local y a minuto exacto. */
export function toLocalInputValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
