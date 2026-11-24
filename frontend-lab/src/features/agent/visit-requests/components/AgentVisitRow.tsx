import { memo, useState } from 'react'
import { Link } from 'react-router'
import type { Visit } from '../../../../core/models/visit'
import { formatDateTime, localInputToUtc, toLocalInputValue } from '../../../../shared/format/date'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '../../../../shared/format/visit'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { StatusBadge } from '../../../../shared/ui/StatusBadge'
import { ReasonPanel } from '../../../my-visits/components/ReasonPanel'
import { VisitDetails } from '../../../my-visits/components/VisitDetails'
import { canComplete, findConflict, findConflictAt, isPast, waitsForClient } from '../visitActions'
import { TimeProposalForm } from './TimeProposalForm'

type Panel = 'propose' | 'reject' | 'cancel' | null

interface AgentVisitRowProps {
  visit: Visit
  title: string | undefined
  href: string
  /** Las visitas programadas del agente: para avisar si el horario pedido choca con otra. */
  agenda: Visit[]
  /** El reloj lo pone el container: este componente es puro. */
  now: Date
  busy: boolean
  error?: string
  onAccept: (visitId: string, proposedAt: string) => void
  onPropose: (visitId: string, localValue: string) => void
  onReject: (visitId: string, reason: string) => void
  onCancel: (visitId: string, reason: string | undefined) => void
  onComplete: (visitId: string) => void
}

function clashMessage(clash: Visit): string {
  const where = clash.propertyTitle ? ` en ${clash.propertyTitle}` : ''
  return `Choca con tu visita${where} del ${formatDateTime(clash.scheduledStart ?? clash.proposedAt)}.`
}

export const AgentVisitRow = memo(function AgentVisitRow({
  visit,
  title,
  href,
  agenda,
  now,
  busy,
  error,
  onAccept,
  onPropose,
  onReject,
  onCancel,
  onComplete,
}: AgentVisitRowProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const name = title ?? 'Propiedad'
  const requested = visit.status === 'REQUESTED'
  const scheduled = visit.status === 'SCHEDULED'
  const waiting = waitsForClient(visit)
  const clash = waiting ? undefined : findConflict(visit, agenda)
  const past = requested && !waiting && isPast(visit, now)
  const close = () => setPanel(null)

  // Si la acción funciona, cambia el estado y el panel deja de aplicar. Si falla, sigue abierto.
  const showPropose = requested && panel === 'propose'
  const showReject = requested && panel === 'reject'
  const showCancel = scheduled && panel === 'cancel'
  const panelOpen = showPropose || showReject || showCancel

  const warningFor = (localValue: string) => {
    const start = new Date(localValue)
    if (Number.isNaN(start.getTime())) return undefined
    const other = findConflictAt(localInputToUtc(localValue), agenda, visit.id)
    return other ? clashMessage(other) : undefined
  }

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
        <StatusBadge
          label={VISIT_STATUS_LABELS[visit.status]}
          tone={VISIT_STATUS_TONES[visit.status]}
        />
      </div>
      <VisitDetails visit={visit} viewer="AGENT" />
      {error && <ErrorMessage message={error} />}
      {requested && !panelOpen && waiting && (
        <p className="row-card__note">Esperando que el interesado responda tu propuesta.</p>
      )}
      {requested && !panelOpen && clash && (
        <p className="row-card__note row-card__note--warning">
          {clashMessage(clash)} Propón otro horario.
        </p>
      )}
      {!panelOpen && !clash && past && (
        <p className="row-card__note row-card__note--warning">
          El horario que pidió ya pasó. Propón otro.
        </p>
      )}
      {showPropose && (
        <TimeProposalForm
          initialValue={toLocalInputValue(new Date(visit.proposedAt))}
          minValue={toLocalInputValue(now)}
          busy={busy}
          hint="El interesado recibe un aviso y puede aceptar el horario o proponer otro."
          submitLabel="Enviar propuesta"
          warningFor={warningFor}
          onSubmit={(value) => onPropose(visit.id, value)}
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
          {requested && !waiting && (
            <Button
              disabled={busy || Boolean(clash) || past}
              aria-label={`Aceptar: ${name}`}
              onClick={() => onAccept(visit.id, visit.proposedAt)}
            >
              Aceptar
            </Button>
          )}
          {requested && (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                aria-label={`${waiting ? 'Cambiar propuesta' : 'Proponer otro horario'}: ${name}`}
                onClick={() => setPanel('propose')}
              >
                {waiting ? 'Cambiar propuesta' : 'Proponer otro horario'}
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
