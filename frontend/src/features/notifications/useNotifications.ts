import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { notificationsApi } from '../../core/api/notificationsApi'
import { errorMessage } from '../../core/api/problem'

const PAGE_SIZE = 20
/** Los avisos nacen de eventos: nadie le avisa al navegador, así que el contador se vuelve a pedir. */
const UNREAD_POLL_MS = 60_000

/** Facade de la página de avisos: el filtro y la página viven en la URL. */
export function useNotificationsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const unread = search.get('unread') === 'true'
  const requested = Number(search.get('page'))
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1

  const result = useQuery({
    queryKey: ['notifications', 'page', unread, page],
    queryFn: ({ signal }) => notificationsApi.list({ page, size: PAGE_SIZE, unread }, signal),
    placeholderData: keepPreviousData,
  })

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const changeUnread = useCallback(
    (next: boolean) => setSearch(next ? { unread: 'true' } : {}),
    [setSearch],
  )

  const goToPage = useCallback(
    (next: number) =>
      setSearch({
        ...(unread ? { unread: 'true' } : {}),
        ...(next > 1 ? { page: String(next) } : {}),
      }),
    [setSearch, unread],
  )

  return {
    unread,
    changeUnread,
    goToPage,
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
    markRead: markRead.mutate,
    markingId: markRead.isPending ? markRead.variables : null,
    markError: markRead.error ? errorMessage(markRead.error) : undefined,
  }
}

/** Facade del contador de la cabecera. Si falla no molesta: simplemente no hay número. */
export function useUnreadCount(): number {
  const result = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: ({ signal }) => notificationsApi.list({ page: 1, size: 1, unread: true }, signal),
    refetchInterval: UNREAD_POLL_MS,
  })
  return result.data?.page.totalElements ?? 0
}
