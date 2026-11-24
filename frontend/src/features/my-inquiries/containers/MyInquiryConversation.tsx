import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../shared/ui/LoadingState'
import { InquiryConversation } from '../../agent/inquiries/components/InquiryConversation'
import { useMyInquiry } from '../useMyInquiries'

/** Smart: se monta al abrir la consulta, así que recién ahí pide la conversación. */
export function MyInquiryConversation({ inquiryId }: { inquiryId: string }) {
  const { inquiry, loading, error } = useMyInquiry(inquiryId)
  if (loading) return <LoadingState label="Cargando la consulta…" />
  if (error || !inquiry) return <ErrorMessage message={error ?? 'Intenta de nuevo.'} />
  return (
    <div className="stack stack--full">
      <InquiryConversation inquiry={inquiry} />
      {!inquiry.reply && (
        <p className="row-card__meta">
          El agente todavía no respondió. Te llegará un aviso cuando lo haga.
        </p>
      )}
    </div>
  )
}
