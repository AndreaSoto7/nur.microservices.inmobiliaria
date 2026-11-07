import type { VisitStatus } from '../../core/models/visit'
import type { StatusTone } from '../ui/StatusBadge'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  REQUESTED: 'Solicitada',
  SCHEDULED: 'Programada',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
  REJECTED: 'Rechazada',
}

export const VISIT_STATUS_TONES: Record<VisitStatus, StatusTone> = {
  REQUESTED: 'warning',
  SCHEDULED: 'success',
  COMPLETED: 'closed',
  CANCELLED: 'neutral',
  REJECTED: 'neutral',
}

const SYSTEM_REASON_LABELS: Record<string, string> = {
  PROPERTY_RESERVED: 'La propiedad fue reservada.',
  PROPERTY_UNAVAILABLE: 'La propiedad ya no está disponible.',
}

/** Las políticas de visit dejan un código como motivo; el de una persona es texto libre y va tal cual. */
export function visitReasonLabel(reason: string): string {
  return SYSTEM_REASON_LABELS[reason] ?? reason
}
