import { memo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { InquirySummary } from '../../../../core/models/visit'
import { formatDateTime } from '../../../../shared/format/date'
import { Button } from '../../../../shared/ui/Button'

interface InquiryRowProps {
  inquiry: InquirySummary
  title: string | undefined
  href: string
  expanded: boolean
  onToggle: (inquiryId: string) => void
  /** El detalle lo pide el container, solo si la consulta está abierta. */
  children?: ReactNode
}

export const InquiryRow = memo(function InquiryRow({
  inquiry,
  title,
  href,
  expanded,
  onToggle,
  children,
}: InquiryRowProps) {
  return (
    <li className="card row-card">
      <div>
        <h2 className="row-card__title">{inquiry.contactName}</h2>
        {title && (
          <p className="row-card__meta">
            Sobre <Link to={href}>{title}</Link>
          </p>
        )}
        <p className="row-card__meta">{formatDateTime(inquiry.createdAt)}</p>
      </div>
      {children}
      <div className="action-bar">
        <Button
          variant="secondary"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ocultar' : 'Ver'} consulta de ${inquiry.contactName}`}
          onClick={() => onToggle(inquiry.id)}
        >
          {expanded ? 'Ocultar consulta' : 'Ver consulta'}
        </Button>
      </div>
    </li>
  )
})
