import type { Lead, LeadOutcome, LeadStatus } from '../../core/models/visit'
import type { StatusTone } from '../ui/StatusBadge'

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
}

export const LEAD_OUTCOME_LABELS: Record<LeadOutcome, string> = {
  WON: 'Ganada',
  LOST: 'Perdida',
}

/** Una oportunidad cerrada se describe por su resultado, que es lo que importa. */
export function leadBadge(lead: Lead): { label: string; tone: StatusTone } {
  if (lead.status === 'OPEN') return { label: LEAD_STATUS_LABELS.OPEN, tone: 'warning' }
  if (lead.outcome === 'WON') return { label: LEAD_OUTCOME_LABELS.WON, tone: 'success' }
  if (lead.outcome === 'LOST') return { label: LEAD_OUTCOME_LABELS.LOST, tone: 'neutral' }
  return { label: LEAD_STATUS_LABELS.CLOSED, tone: 'closed' }
}
