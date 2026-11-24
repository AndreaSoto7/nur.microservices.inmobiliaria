import { memo } from 'react'
import type { Visit } from '../../../core/models/visit'
import { formatDateTime, formatTime } from '../../../shared/format/date'
import { visitReasonLabel } from '../../../shared/format/visit'

type Viewer = 'CLIENT' | 'AGENT'

const PROPOSAL_LABELS: Record<Viewer, Record<'CLIENT' | 'AGENT', string>> = {
  CLIENT: { CLIENT: 'Horario que pediste', AGENT: 'Propuesta del agente' },
  AGENT: { CLIENT: 'Horario pedido', AGENT: 'Tu propuesta' },
}

interface VisitDetailsProps {
  visit: Visit
  /** Quién mira: cambia cómo se nombra el horario propuesto. */
  viewer: Viewer
}

/** Dumb: las fechas y el motivo de una visita. Lo usan el interesado y el agente. */
export const VisitDetails = memo(function VisitDetails({ visit, viewer }: VisitDetailsProps) {
  return (
    <dl className="specs">
      {visit.scheduledStart ? (
        <>
          <dt>Horario</dt>
          <dd>
            {formatDateTime(visit.scheduledStart)}
            {visit.scheduledEnd && ` a ${formatTime(visit.scheduledEnd)}`}
          </dd>
        </>
      ) : (
        <>
          <dt>{PROPOSAL_LABELS[viewer][visit.proposedBy ?? 'CLIENT']}</dt>
          <dd>{formatDateTime(visit.proposedAt)}</dd>
        </>
      )}
      {visit.completedAt && (
        <>
          <dt>Realizada</dt>
          <dd>{formatDateTime(visit.completedAt)}</dd>
        </>
      )}
      {visit.resolutionReason && (
        <>
          <dt>Motivo</dt>
          <dd>{visitReasonLabel(visit.resolutionReason)}</dd>
        </>
      )}
    </dl>
  )
})
