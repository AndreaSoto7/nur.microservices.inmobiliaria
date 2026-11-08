import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../../core/api/problem'
import { usersApi } from '../../core/api/usersApi'
import { ROLES, type Role } from '../../core/models/identity'
import { parsePageParam } from '../../shared/format/pageParam'

export type UserAction =
  | { kind: 'roles'; userId: string; roles: Role[] }
  | { kind: 'deactivate'; userId: string }
  | { kind: 'activate'; userId: string }

function run(action: UserAction): Promise<void> {
  switch (action.kind) {
    case 'roles':
      return usersApi.assignRoles(action.userId, action.roles)
    case 'deactivate':
      return usersApi.deactivate(action.userId)
    case 'activate':
      return usersApi.activate(action.userId)
  }
}

/** Facade de la administración de usuarios: el rol y la página viven en la URL. */
export function useAdminUsers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const role = ROLES.find((candidate) => candidate === search.get('role'))
  const page = parsePageParam(search.get('page'))

  const result = useQuery({
    queryKey: ['admin-users', role, page],
    queryFn: ({ signal }) => usersApi.list({ role, page }, signal),
    placeholderData: keepPreviousData,
  })

  const action = useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const changeRole = useCallback(
    (next: Role | undefined) => setSearch(next ? { role: next } : {}),
    [setSearch],
  )

  const goToPage = useCallback(
    (next: number) =>
      setSearch({ ...(role ? { role } : {}), ...(next > 1 ? { page: String(next) } : {}) }),
    [setSearch, role],
  )

  return {
    role,
    changeRole,
    goToPage,
    page: result.data,
    loading: result.isPending,
    error: result.isError ? errorMessage(result.error) : undefined,
    retry: result.refetch,
    runAction: action.mutate,
    busyUserId: action.isPending ? action.variables.userId : null,
    failedUserId: action.isError ? action.variables.userId : null,
    actionError: action.error ? errorMessage(action.error) : undefined,
  }
}
