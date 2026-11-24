import { memo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { InquirySummary } from '../../../core/models/visit'
import { formatDateTime } from '../../../shared/format/date'
import { Button } from '../../../shared/ui/Button'
import { StatusBadge } from '../../../shared/ui/StatusBadge'

interface MyInquiryRowProps {
  inquiry: InquirySummary
  title: string | undefined
  href: string
  expanded: boolean
  onToggle: (inquiryId: string) => void
  /** La conversación la pide el container, solo si la consulta está abierta. */
  children?: ReactNode
}

/** Dumb: una consulta enviada, con su estado y la conversación al abrirla. */
export const MyInquiryRow = memo(function MyInquiryRow({
  inquiry,
  title,
  href,
  expanded,
  onToggle,
  children,
}: MyInquiryRowProps) {
  const name = title ?? 'Propiedad'
  return (
    <li className="card row-card">
      <div className="row-card__head">
        <h2 className="row-card__title">{title ? <Link to={href}>{title}</Link> : name}</h2>
        <StatusBadge
          label={inquiry.repliedAt ? 'Respondida' : 'Esperando respuesta'}
          tone={inquiry.repliedAt ? 'success' : 'neutral'}
        />
      </div>
      <p className="row-card__meta">Enviada el {formatDateTime(inquiry.createdAt)}</p>
      {children}
      <div className="action-bar">
        <Button
          variant="secondary"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ocultar' : 'Ver'} consulta sobre ${name}`}
          onClick={() => onToggle(inquiry.id)}
        >
          {expanded ? 'Ocultar consulta' : 'Ver consulta'}
        </Button>
      </div>
    </li>
  )
})
