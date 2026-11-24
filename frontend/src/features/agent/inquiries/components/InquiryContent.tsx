import { memo } from 'react'
import type { Inquiry } from '../../../../core/models/visit'
import { InquiryConversation } from './InquiryConversation'

/** Dumb: lo que ve el agente de una consulta: la conversación y cómo contactar al interesado. */
export const InquiryContent = memo(function InquiryContent({ inquiry }: { inquiry: Inquiry }) {
  return (
    <div className="stack stack--full">
      <InquiryConversation inquiry={inquiry} />
      <dl className="specs">
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
    </div>
  )
})
