import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../../shared/ui/LoadingState'
import { InquiryContent } from '../components/InquiryContent'
import { useInquiryDetail } from '../useAgentInquiries'

/** Smart: se monta al abrir la consulta, así que recién ahí pide el mensaje. */
export function InquiryDetailSection({ inquiryId }: { inquiryId: string }) {
  const { inquiry, loading, error } = useInquiryDetail(inquiryId)
  if (loading) return <LoadingState label="Cargando la consulta…" />
  if (error || !inquiry) return <ErrorMessage message={error ?? 'Intenta de nuevo.'} />
  return <InquiryContent inquiry={inquiry} />
}
