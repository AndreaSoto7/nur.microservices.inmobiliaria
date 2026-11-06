import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { inquiriesApi } from '../../../core/api/inquiriesApi'
import { errorMessage } from '../../../core/api/problem'
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
