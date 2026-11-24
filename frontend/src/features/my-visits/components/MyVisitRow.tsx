import { memo, useState } from 'react'
import { Link } from 'react-router'
import type { Visit } from '../../../core/models/visit'
import { toLocalInputValue } from '../../../shared/format/date'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '../../../shared/format/visit'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { TimeProposalForm } from '../../agent/visit-requests/components/TimeProposalForm'
import { ReasonPanel } from './ReasonPanel'
import { VisitDetails } from './VisitDetails'

type Panel = 'cancel' | 'propose' | null

interface MyVisitRowProps {
  visit: Visit
  /** El contrato lo trae como opcional: visit puede no haber recibido la propiedad. */
  title: string | undefined
  href: string
  /** El reloj lo pone el container: este componente es puro. */
  now: Date
  busy: boolean
  error?: string
  onCancel: (visitId: string, reason: string | undefined) => void
  onAccept: (visitId: string) => void
  onPropose: (visitId: string, localValue: string) => void
}

export const MyVisitRow = memo(function MyVisitRow({
  visit,
  title,
  href,
  now,
  busy,
  error,
  onCancel,
  onAccept,
  onPropose,
}: MyVisitRowProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const name = title ?? 'Propiedad no disponible'
  const requested = visit.status === 'REQUESTED'
  const agentProposal = requested && visit.proposedBy === 'AGENT'
  const expired = requested && new Date(visit.proposedAt) <= now
  const close = () => setPanel(null)

  // Si la acción funciona, cambia el estado y el panel deja de aplicar. Si falla, sigue abierto.
  const showCancel = visit.status === 'SCHEDULED' && panel === 'cancel'
  const showPropose = requested && panel === 'propose'
  const panelOpen = showCancel || showPropose

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
        <StatusBadge
          label={VISIT_STATUS_LABELS[visit.status]}
          tone={VISIT_STATUS_TONES[visit.status]}
        />
      </div>
      <VisitDetails visit={visit} viewer="CLIENT" />
      {error && <ErrorMessage message={error} />}
      {!panelOpen && agentProposal && (
        <p className={`row-card__note${expired ? ' row-card__note--warning' : ''}`}>
          {expired
            ? 'El horario que te propuso el agente ya pasó. Propón otro.'
            : 'El agente te propone este horario. ¿Te sirve?'}
        </p>
      )}
      {!panelOpen && requested && !agentProposal && (
        <p className={`row-card__note${expired ? ' row-card__note--warning' : ''}`}>
          {expired
            ? 'El horario que pediste ya pasó. Cámbialo para que el agente pueda confirmarlo.'
            : 'Esperando que el agente confirme el horario.'}
        </p>
      )}
      {showPropose && (
        <TimeProposalForm
          initialValue={toLocalInputValue(new Date(visit.proposedAt))}
          minValue={toLocalInputValue(now)}
          busy={busy}
          hint="El agente recibe un aviso y confirma el horario o te propone otro."
          submitLabel="Enviar horario"
          onSubmit={(value) => onPropose(visit.id, value)}
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
      {!panelOpen && (requested || visit.status === 'SCHEDULED') && (
        <div className="action-bar">
          {agentProposal && (
            <Button
              disabled={busy || expired}
              aria-label={`Aceptar horario: ${name}`}
              onClick={() => onAccept(visit.id)}
            >
              Aceptar horario
            </Button>
          )}
          {requested && (
            <Button
              variant="secondary"
              disabled={busy}
              aria-label={`${agentProposal ? 'Proponer otro horario' : 'Cambiar horario'}: ${name}`}
              onClick={() => setPanel('propose')}
            >
              {agentProposal ? 'Proponer otro horario' : 'Cambiar horario'}
            </Button>
          )}
          {visit.status === 'SCHEDULED' && (
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
