import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useIdempotencyKey } from '../../../core/api/idempotency'
import { inquiriesApi } from '../../../core/api/inquiriesApi'
import { ApiError, errorMessage } from '../../../core/api/problem'
import { parsePageParam } from '../../../shared/format/pageParam'

/** Facade de las consultas del agente: la página vive en la URL. */
export function useAgentInquiries() {
  const [search, setSearch] = useSearchParams()
  const page = parsePageParam(search.get('page'))
  const result = useQuery({
    queryKey: ['agent-inquiries', page],
    queryFn: ({ signal }) => inquiriesApi.list({ page }, signal),
    placeholderData: keepPreviousData,
  })
  const goToPage = useCallback(
    (next: number) => setSearch(next > 1 ? { page: String(next) } : {}),
    [setSearch],
  )
  return {
    goToPage,
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
  }
}

/** Facade del detalle de una consulta. */
export function useInquiryDetail(inquiryId: string) {
  const result = useQuery({
    queryKey: ['agent-inquiry', inquiryId],
    queryFn: ({ signal }) => inquiriesApi.get(inquiryId, signal),
  })
  return {
    inquiry: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
  }
}

/** Facade de responder una consulta: al terminar, se vuelve a pedir la consulta y la bandeja. */
export function useReplyInquiry(inquiryId: string) {
  const queryClient = useQueryClient()
  const keyFor = useIdempotencyKey()
  const mutation = useMutation({
    mutationFn: (message: string) =>
      inquiriesApi.reply(inquiryId, message, keyFor({ inquiryId, message })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-inquiry', inquiryId] })
      return queryClient.invalidateQueries({ queryKey: ['agent-inquiries'] })
    },
  })
  return {
    reply: mutation.mutate,
    sending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
    fieldError: mutation.error instanceof ApiError ? mutation.error.fieldErrors.message : undefined,
  }
}
