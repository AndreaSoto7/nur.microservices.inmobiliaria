import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { favoritesApi } from '../../core/api/favoritesApi'
import { ApiError, errorMessage } from '../../core/api/problem'
import { useAuth } from '../../core/auth/AuthContext'

const PAGE_SIZE = 12
/** El contrato no dice si una propiedad es favorita: se deriva del máximo que permite una página. */
const LOOKUP_SIZE = 100

/** Lo que el usuario quería ya es cierto: lo cambió en otra pestaña o en otro dispositivo. */
const alreadyApplied = (error: unknown, code: string) =>
  error instanceof ApiError && error.code === code

async function addFavorite(propertyId: string) {
  try {
    await favoritesApi.add(propertyId)
  } catch (error) {
    if (!alreadyApplied(error, 'FAVORITE_ALREADY_EXISTS')) throw error
  }
}

async function removeFavorite(propertyId: string) {
  try {
    await favoritesApi.remove(propertyId)
  } catch (error) {
    if (!alreadyApplied(error, 'FAVORITE_NOT_FOUND')) throw error
  }
}

function useRemoveFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })
}

/** Facade de la página de favoritos: la página vive en la URL. */
export function useFavoritesPage() {
  const [search, setSearch] = useSearchParams()
  const requested = Number(search.get('page'))
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1

  const result = useQuery({
    queryKey: ['favorites', 'page', page],
    queryFn: ({ signal }) => favoritesApi.list({ page, size: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })
  const remove = useRemoveFavorite()

  const goToPage = useCallback(
    (next: number) => setSearch(next > 1 ? { page: String(next) } : {}),
    [setSearch],
  )

  return {
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
    goToPage,
    removeFavorite: remove.mutate,
    removingId: remove.isPending ? remove.variables : null,
    removeError: remove.error ? errorMessage(remove.error) : undefined,
  }
}

/** Facade del botón del detalle. Sin sesión no consulta nada. */
export function useFavoriteToggle(propertyId: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const lookup = useQuery({
    queryKey: ['favorites', 'lookup'],
    queryFn: ({ signal }) => favoritesApi.list({ page: 1, size: LOOKUP_SIZE }, signal),
    enabled: enabled && status === 'authenticated',
  })
  const saved = lookup.data?.data.some((favorite) => favorite.property.id === propertyId) ?? false

  const toggle = useMutation({
    mutationFn: () => (saved ? removeFavorite(propertyId) : addFavorite(propertyId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })

  return {
    saved,
    ready: lookup.isSuccess,
    busy: toggle.isPending || lookup.isFetching,
    error: toggle.error ? errorMessage(toggle.error) : undefined,
    toggle: toggle.mutate,
  }
}
