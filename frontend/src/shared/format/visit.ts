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
