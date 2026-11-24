import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Lead, LeadOutcome } from '../../../../core/models/visit'
import { formatDateTime } from '../../../../shared/format/date'
import { leadBadge } from '../../../../shared/format/lead'
import { Button } from '../../../../shared/ui/Button'
import { ContactLine } from '../../../../shared/ui/ContactLine'
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
  /** Las notas de seguimiento; el container decide cómo se cargan. Solo se montan al abrirlas. */
  notes: ReactNode
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
  notes,
}: LeadRowProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const [showNotes, setShowNotes] = useState(false)
  const name = title ?? 'Propiedad'
  const open = lead.status === 'OPEN'
  const badge = leadBadge(lead)
  const close = () => setPanel(null)

  return (
    <li className="card row-card">
      <div className="row-card__head">
        <div>
          <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
          <ContactLine contact={lead.client} />
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
      {panel === null && (
        <div className="action-bar">
          {open && (
            <>
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
            </>
          )}
          <Button
            variant="secondary"
            aria-expanded={showNotes}
            aria-label={`${showNotes ? 'Ocultar' : 'Ver'} notas: ${name}`}
            onClick={() => setShowNotes((current) => !current)}
          >
            {showNotes ? 'Ocultar notas' : 'Ver notas'}
          </Button>
        </div>
      )}
      {showNotes && <div className="lead-notes__panel">{notes}</div>}
    </li>
  )
})
