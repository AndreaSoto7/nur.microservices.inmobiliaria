import { memo, useState } from 'react'
import { Link } from 'react-router'
import type { Visit } from '../../../../core/models/visit'
import { toLocalInputValue } from '../../../../shared/format/date'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '../../../../shared/format/visit'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { StatusBadge } from '../../../../shared/ui/StatusBadge'
import { ReasonPanel } from '../../../my-visits/components/ReasonPanel'
import { VisitDetails } from '../../../my-visits/components/VisitDetails'
import { canComplete } from '../visitActions'
import { ScheduleVisitForm } from './ScheduleVisitForm'

type Panel = 'schedule' | 'reject' | 'cancel' | null

interface AgentVisitRowProps {
  visit: Visit
  title: string | undefined
  href: string
  /** El reloj lo pone el container: este componente es puro. */
  now: Date
  busy: boolean
  error?: string
  onSchedule: (visitId: string, localValue: string) => void
  onReject: (visitId: string, reason: string) => void
  onCancel: (visitId: string, reason: string | undefined) => void
  onComplete: (visitId: string) => void
}

export const AgentVisitRow = memo(function AgentVisitRow({
  visit,
  title,
  href,
  now,
  busy,
  error,
  onSchedule,
  onReject,
  onCancel,
  onComplete,
}: AgentVisitRowProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const name = title ?? 'Propiedad'
  const requested = visit.status === 'REQUESTED'
  const scheduled = visit.status === 'SCHEDULED'
  const close = () => setPanel(null)

  // Si la acción funciona, cambia el estado y el panel deja de aplicar. Si falla, sigue abierto.
  const showSchedule = requested && panel === 'schedule'
  const showReject = requested && panel === 'reject'
  const showCancel = scheduled && panel === 'cancel'
  const panelOpen = showSchedule || showReject || showCancel

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
      {error && <ErrorMessage message={error} />}
      {showSchedule && (
        <ScheduleVisitForm
          initialValue={toLocalInputValue(new Date(visit.proposedAt))}
          minValue={toLocalInputValue(now)}
          busy={busy}
          onSubmit={(value) => onSchedule(visit.id, value)}
          onBack={close}
        />
      )}
      {showReject && (
        <ReasonPanel
          message="El interesado va a ver este motivo."
          reasonLabel="Motivo"
          reasonRequired
          confirmLabel="Sí, rechazar"
          busy={busy}
          onConfirm={(reason) => reason && onReject(visit.id, reason)}
          onBack={close}
        />
      )}
      {showCancel && (
        <ReasonPanel
          message="La visita se cancela y el horario queda libre."
          reasonLabel="Motivo (opcional)"
          reasonRequired={false}
          confirmLabel="Sí, cancelar"
          busy={busy}
          onConfirm={(reason) => onCancel(visit.id, reason)}
          onBack={close}
        />
      )}
      {!panelOpen && (requested || scheduled) && (
        <div className="action-bar">
          {requested && (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                aria-label={`Programar: ${name}`}
                onClick={() => setPanel('schedule')}
              >
                Programar
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                aria-label={`Rechazar: ${name}`}
                onClick={() => setPanel('reject')}
              >
                Rechazar
              </Button>
            </>
          )}
          {canComplete(visit, now) && (
            <Button
              variant="secondary"
              disabled={busy}
              aria-label={`Marcar realizada: ${name}`}
              onClick={() => onComplete(visit.id)}
            >
              Marcar realizada
            </Button>
          )}
          {scheduled && (
            <Button
              variant="secondary"
              disabled={busy}
              aria-label={`Cancelar visita: ${name}`}
              onClick={() => setPanel('cancel')}
            >
              Cancelar visita
            </Button>
          )}
        </div>
      )}
    </li>
  )
})
