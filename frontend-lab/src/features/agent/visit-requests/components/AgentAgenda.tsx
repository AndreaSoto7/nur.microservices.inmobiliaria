import { memo } from 'react'
import { Link } from 'react-router'
import type { Visit } from '../../../../core/models/visit'
import { formatDay, formatTime } from '../../../../shared/format/date'

const SHOWN = 4

interface AgentAgendaProps {
  /** Las visitas programadas que todavía no terminaron, de la más próxima a la más lejana. */
  visits: Visit[]
  hrefFor: (visit: Visit) => string
  onShowAll: () => void
}

/** Dumb: las próximas visitas del agente, para ver de un vistazo qué horarios ya están ocupados. */
export const AgentAgenda = memo(function AgentAgenda({
  visits,
  hrefFor,
  onShowAll,
}: AgentAgendaProps) {
  const rest = visits.length - SHOWN
  return (
    <section className="agenda" aria-labelledby="agenda-title">
      <h2 id="agenda-title" className="agenda__title">
        Próximas visitas
      </h2>
      <ol className="agenda__list">
        {visits.slice(0, SHOWN).map((visit) => (
          <li key={visit.id} className="agenda__item">
            <span className="agenda__when">
              <span className="agenda__day">
                {formatDay(visit.scheduledStart ?? visit.proposedAt)}
              </span>
              <span className="agenda__time">
                {formatTime(visit.scheduledStart ?? visit.proposedAt)}
                {visit.scheduledEnd && ` a ${formatTime(visit.scheduledEnd)}`}
              </span>
            </span>
            <Link className="agenda__what" to={hrefFor(visit)}>
              {visit.propertyTitle ?? 'Propiedad'}
            </Link>
          </li>
        ))}
      </ol>
      {rest > 0 && (
        <button type="button" className="link-button agenda__more" onClick={onShowAll}>
          Ver las {visits.length} visitas programadas
        </button>
      )}
    </section>
  )
})
