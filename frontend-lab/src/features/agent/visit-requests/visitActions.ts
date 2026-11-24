import type { Visit } from '../../../core/models/visit'

/** visit fija la duración de una visita en 60 minutos. */
export const VISIT_DURATION_MS = 60 * 60 * 1000

/** visit responde VISIT_COMPLETION_TOO_EARLY antes de que termine el horario: no se ofrece hasta entonces. */
export function canComplete(visit: Visit, now: Date): boolean {
  return (
    visit.status === 'SCHEDULED' &&
    visit.scheduledEnd !== undefined &&
    new Date(visit.scheduledEnd) <= now
  )
}

/** Las visitas programadas que todavía no terminaron, de la más próxima a la más lejana. */
export function upcoming(agenda: Visit[], now: Date): Visit[] {
  return agenda
    .filter(
      (visit) =>
        visit.status === 'SCHEDULED' && visit.scheduledEnd && new Date(visit.scheduledEnd) > now,
    )
    .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''))
}

/** Si el último horario lo propuso el agente: la solicitud espera la respuesta del interesado. */
export function waitsForClient(visit: Visit): boolean {
  return visit.status === 'REQUESTED' && visit.proposedBy === 'AGENT'
}

/** La visita pendiente cuyo horario ya pasó: no se puede aceptar, hay que proponer otro. */
export function isPast(visit: Visit, now: Date): boolean {
  return new Date(visit.proposedAt) <= now
}

/**
 * La visita programada del agente que se cruza con el horario propuesto, si hay alguna. Dos visitas
 * consecutivas no chocan: una puede empezar justo cuando termina la otra (igual que en visit).
 */
export function findConflict(visit: Visit, agenda: Visit[]): Visit | undefined {
  if (visit.status !== 'REQUESTED') return undefined
  return findConflictAt(visit.proposedAt, agenda, visit.id)
}

/** La visita programada que se cruza con una hora de inicio cualquiera (la que se está por proponer). */
export function findConflictAt(startIso: string, agenda: Visit[], ignoreId?: string) {
  const start = new Date(startIso).getTime()
  if (Number.isNaN(start)) return undefined
  const end = start + VISIT_DURATION_MS
  return agenda.find((other) => {
    if (other.id === ignoreId || other.status !== 'SCHEDULED') return false
    if (!other.scheduledStart || !other.scheduledEnd) return false
    const otherStart = new Date(other.scheduledStart).getTime()
    const otherEnd = new Date(other.scheduledEnd).getTime()
    return start < otherEnd && otherStart < end
  })
}
