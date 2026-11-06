import { memo } from 'react'
import type { Visit } from '../../../core/models/visit'
import { formatDateTime } from '../../../shared/format/date'

/** Dumb: las fechas y el motivo de una visita. Lo usan el interesado y el agente. */
export const VisitDetails = memo(function VisitDetails({ visit }: { visit: Visit }) {
  return (
    <dl className="specs">
      <dt>Fecha propuesta</dt>
      <dd>{formatDateTime(visit.proposedAt)}</dd>
      {visit.scheduledStart && (
        <>
          <dt>Horario</dt>
          <dd>{formatDateTime(visit.scheduledStart)}</dd>
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
          <dd>{visit.resolutionReason}</dd>
        </>
      )}
    </dl>
  )
})
