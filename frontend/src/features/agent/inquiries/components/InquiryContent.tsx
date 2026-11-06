import { memo } from 'react'
import type { Inquiry } from '../../../../core/models/visit'

export const InquiryContent = memo(function InquiryContent({ inquiry }: { inquiry: Inquiry }) {
  return (
    <dl className="specs">
      <dt>Mensaje</dt>
      <dd className="inquiry__message">{inquiry.message}</dd>
      <dt>Email</dt>
      <dd>
        <a href={`mailto:${inquiry.contactEmail}`}>{inquiry.contactEmail}</a>
      </dd>
      {inquiry.contactPhone && (
        <>
          <dt>Teléfono</dt>
          <dd>
            <a href={`tel:${inquiry.contactPhone}`}>{inquiry.contactPhone}</a>
          </dd>
        </>
      )}
    </dl>
  )
})
