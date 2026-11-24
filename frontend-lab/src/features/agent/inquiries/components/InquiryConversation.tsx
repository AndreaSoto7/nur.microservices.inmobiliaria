import { memo } from 'react'
import type { Inquiry } from '../../../../core/models/visit'
import { formatDateTime } from '../../../../shared/format/date'

/** Dumb: la pregunta del interesado y, si ya la hay, la respuesta del agente. */
export const InquiryConversation = memo(function InquiryConversation({
  inquiry,
}: {
  inquiry: Inquiry
}) {
  return (
    <div className="conversation">
      <div className="conversation__message">
        <p className="conversation__who">
          {inquiry.contactName} · {formatDateTime(inquiry.createdAt)}
        </p>
        <p className="conversation__text">{inquiry.message}</p>
      </div>
      {inquiry.reply && inquiry.repliedAt && (
        <div className="conversation__message conversation__message--reply">
          <p className="conversation__who">
            Respuesta del agente · {formatDateTime(inquiry.repliedAt)}
          </p>
          <p className="conversation__text">{inquiry.reply}</p>
        </div>
      )}
    </div>
  )
})
