import type { Visit } from '../../../core/models/visit'

/** visit responde VISIT_COMPLETION_TOO_EARLY antes de que termine el horario: no se ofrece hasta entonces. */
export function canComplete(visit: Visit, now: Date): boolean {
  return (
    visit.status === 'SCHEDULED' &&
    visit.scheduledEnd !== undefined &&
    new Date(visit.scheduledEnd) <= now
  )
}
