import { memo } from 'react'
import type { LeadFollowUp } from '../../../../core/models/visit'
import { formatDateTime } from '../../../../shared/format/date'

/** Dumb: las notas de seguimiento de una oportunidad, de la más antigua a la más nueva. */
export const LeadNotes = memo(function LeadNotes({ notes }: { notes: LeadFollowUp[] }) {
  if (notes.length === 0) {
    return <p className="row-card__meta">Todavía no hay notas en esta oportunidad.</p>
  }
  return (
    <ol className="lead-notes" aria-label="Notas de seguimiento">
      {notes.map((note) => (
        <li key={note.id} className="lead-note">
          <time className="lead-note__date" dateTime={note.createdAt}>
            {formatDateTime(note.createdAt)}
          </time>
          <p className="lead-note__text">{note.note}</p>
        </li>
      ))}
    </ol>
  )
})
