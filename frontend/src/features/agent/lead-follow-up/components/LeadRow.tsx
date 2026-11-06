import { memo, useState } from 'react'
import { Link } from 'react-router'
import type { Lead, LeadOutcome } from '../../../../core/models/visit'
import { formatDateTime } from '../../../../shared/format/date'
import { leadBadge } from '../../../../shared/format/lead'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { StatusBadge } from '../../../../shared/ui/StatusBadge'
import { ReasonPanel } from '../../../my-visits/components/ReasonPanel'
import { CloseLeadForm } from './CloseLeadForm'

type Panel = 'note' | 'close' | null

interface LeadRowProps {
  lead: Lead
  title: string | undefined
  href: string
  busy: boolean
  error?: string
  noteSaved: boolean
  reserving: boolean
  onAddNote: (leadId: string, note: string, onDone: () => void) => void
  onClose: (leadId: string, outcome: LeadOutcome, note: string | undefined) => void
}

export const LeadRow = memo(function LeadRow({
  lead,
  title,
  href,
  busy,
  error,
  noteSaved,
  reserving,
  onAddNote,
  onClose,
}: LeadRowProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const name = title ?? 'Propiedad'
  const open = lead.status === 'OPEN'
  const badge = leadBadge(lead)
  const close = () => setPanel(null)

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <div>
          <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
          <p className="row-card__meta">Abierta el {formatDateTime(lead.openedAt)}</p>
          {lead.closedAt && (
            <p className="row-card__meta">Cerrada el {formatDateTime(lead.closedAt)}</p>
          )}
        </div>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>
      {error && <ErrorMessage message={error} />}
      {noteSaved && panel === null && (
        <p className="notice notice--success" role="status">
          Nota guardada.
        </p>
      )}
      {reserving && (
        <p className="notice notice--success" role="status">
          La propiedad queda reservada en unos instantes.
        </p>
      )}
      {open && panel === 'note' && (
        <ReasonPanel
          message="La nota queda en el seguimiento de esta oportunidad."
          reasonLabel="Nota"
          reasonRequired
          maxLength={2000}
          tone="neutral"
          confirmLabel="Guardar nota"
          busy={busy}
          onConfirm={(note) => note && onAddNote(lead.id, note, close)}
          onBack={close}
        />
      )}
      {open && panel === 'close' && (
        <CloseLeadForm
          busy={busy}
          onClose={(outcome, note) => onClose(lead.id, outcome, note)}
          onBack={close}
        />
      )}
      {open && panel === null && (
        <div className="action-bar">
          <Button
            variant="secondary"
            disabled={busy}
            aria-label={`Agregar nota: ${name}`}
            onClick={() => setPanel('note')}
          >
            Agregar nota
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            aria-label={`Cerrar oportunidad: ${name}`}
            onClick={() => setPanel('close')}
          >
            Cerrar oportunidad
          </Button>
        </div>
      )}
    </li>
  )
})
