import { useMutation } from '@tanstack/react-query'
import { useIdempotencyKey } from '../../core/api/idempotency'
import { inquiriesApi } from '../../core/api/inquiriesApi'
import { ApiError, errorMessage } from '../../core/api/problem'
import { visitsApi } from '../../core/api/visitsApi'
import type { RequestVisitRequest, SendInquiryRequest } from '../../core/models/visit'

function mutationState(mutation: { isPending: boolean; isSuccess: boolean; error: Error | null }) {
  return {
    submitting: mutation.isPending,
    sent: mutation.isSuccess,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
    fieldErrors: mutation.error instanceof ApiError ? mutation.error.fieldErrors : {},
  }
}

/** Facade de solicitar una visita. */
export function useRequestVisit() {
  const keyFor = useIdempotencyKey()
  const mutation = useMutation({
    mutationFn: (request: RequestVisitRequest) => visitsApi.request(request, keyFor(request)),
  })
  return { requestVisit: mutation.mutate, ...mutationState(mutation) }
}

/** Facade de enviar una consulta. */
export function useSendInquiry() {
  const keyFor = useIdempotencyKey()
  const mutation = useMutation({
    mutationFn: (request: SendInquiryRequest) => inquiriesApi.send(request, keyFor(request)),
  })
  return { sendInquiry: mutation.mutate, ...mutationState(mutation) }
}
