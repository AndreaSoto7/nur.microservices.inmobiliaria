import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../../shared/ui/LoadingState'
import { InquiryContent } from '../components/InquiryContent'
import { ReplyForm } from '../components/ReplyForm'
import { useInquiryDetail, useReplyInquiry } from '../useAgentInquiries'

/** Smart: se monta al abrir la consulta, así que recién ahí pide el mensaje. Sin respuesta, la ofrece. */
export function InquiryDetailSection({ inquiryId }: { inquiryId: string }) {
  const { inquiry, loading, error } = useInquiryDetail(inquiryId)
  const { reply, sending, error: replyError, fieldError } = useReplyInquiry(inquiryId)
  if (loading) return <LoadingState label="Cargando la consulta…" />
  if (error || !inquiry) return <ErrorMessage message={error ?? 'Intenta de nuevo.'} />
  return (
    <div className="stack stack--full">
      <InquiryContent inquiry={inquiry} />
      {!inquiry.reply && (
        <ReplyForm sending={sending} error={replyError} fieldError={fieldError} onReply={reply} />
      )}
    </div>
  )
}
