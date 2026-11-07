import { memo, useState } from 'react'
import { Link } from 'react-router'
import type { Visit } from '../../../core/models/visit'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '../../../shared/format/visit'
import { Button } from '../../../shared/ui/Button'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { ReasonPanel } from './ReasonPanel'
import { VisitDetails } from './VisitDetails'

interface MyVisitRowProps {
  visit: Visit
  /** El contrato lo trae como opcional: visit puede no haber recibido la propiedad. */
  title: string | undefined
  href: string
  cancelling: boolean
  onCancel: (visitId: string, reason: string | undefined) => void
}

export const MyVisitRow = memo(function MyVisitRow({
  visit,
  title,
  href,
  cancelling,
  onCancel,
}: MyVisitRowProps) {
  const [confirming, setConfirming] = useState(false)
  const name = title ?? 'Propiedad no disponible'

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
        <StatusBadge
          label={VISIT_STATUS_LABELS[visit.status]}
          tone={VISIT_STATUS_TONES[visit.status]}
        />
      </div>
      <VisitDetails visit={visit} />
      {visit.status === 'SCHEDULED' &&
        (confirming ? (
          <ReasonPanel
            message="La visita se cancela y el horario queda libre."
            reasonLabel="Motivo (opcional)"
            reasonRequired={false}
            confirmLabel="Sí, cancelar"
            busy={cancelling}
            onConfirm={(reason) => {
              setConfirming(false)
              onCancel(visit.id, reason)
            }}
            onBack={() => setConfirming(false)}
          />
        ) : (
          <div className="action-bar">
            <Button
              variant="secondary"
              disabled={cancelling}
              aria-label={`Cancelar visita: ${name}`}
              onClick={() => setConfirming(true)}
            >
              Cancelar visita
            </Button>
          </div>
        ))}
    </li>
  )
})
