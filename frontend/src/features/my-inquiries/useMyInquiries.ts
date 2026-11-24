import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { inquiriesApi } from '../../core/api/inquiriesApi'
import { errorMessage } from '../../core/api/problem'
import { parsePageParam } from '../../shared/format/pageParam'

/** Facade de las consultas que envió el interesado: la página vive en la URL. */
export function useMyInquiries() {
  const [search, setSearch] = useSearchParams()
  const page = parsePageParam(search.get('page'))
  const result = useQuery({
    queryKey: ['my-inquiries', page],
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

/** Facade del detalle: la pregunta y la respuesta, si ya la hay. */
export function useMyInquiry(inquiryId: string) {
  const result = useQuery({
    queryKey: ['my-inquiry', inquiryId],
    queryFn: ({ signal }) => inquiriesApi.get(inquiryId, signal),
  })
  return {
    inquiry: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
  }
}
