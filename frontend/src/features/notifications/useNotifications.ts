import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { notificationsApi } from '../../core/api/notificationsApi'
import { errorMessage } from '../../core/api/problem'
import { parsePageParam } from '../../shared/format/pageParam'

const PAGE_SIZE = 20
/** Los avisos nacen de eventos: nadie le avisa al navegador, así que se vuelven a pedir cada tanto. */
const UNREAD_POLL_MS = 30_000
/** Los últimos sin leer: alcanzan para el contador (totalElements) y para anunciar los nuevos. */
const LATEST_UNREAD = 5

/** Facade de la página de avisos: el filtro y la página viven en la URL. */
export function useNotificationsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const unread = search.get('unread') === 'true'
  const page = parsePageParam(search.get('page'))

  const result = useQuery({
    queryKey: ['notifications', 'page', unread, page],
    queryFn: ({ signal }) => notificationsApi.list({ page, size: PAGE_SIZE, unread }, signal),
    placeholderData: keepPreviousData,
  })

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const remove = useMutation({
    mutationFn: notificationsApi.remove,
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
    remove: remove.mutate,
    /** El aviso con una acción en curso: sus botones se desactivan. */
    busyId: markRead.isPending ? markRead.variables : remove.isPending ? remove.variables : null,
    actionError: markRead.error
      ? errorMessage(markRead.error)
      : remove.error
        ? errorMessage(remove.error)
        : undefined,
  }
}

/**
 * Los últimos avisos sin leer, consultados cada 30 segundos. La comparten el contador de la cabecera y el
 * anuncio de avisos nuevos: es una sola request. Si falla no molesta: no hay número ni anuncio.
 */
export function useLatestUnread() {
  return useQuery({
    queryKey: ['notifications', 'unread-latest'],
    queryFn: ({ signal }) =>
      notificationsApi.list({ page: 1, size: LATEST_UNREAD, unread: true }, signal),
    refetchInterval: UNREAD_POLL_MS,
  })
}

/** Facade del contador de la cabecera. */
export function useUnreadCount(): number {
  return useLatestUnread().data?.page.totalElements ?? 0
}
