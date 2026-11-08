import type { AdminUser, Role } from '../models/identity'
import type { Page } from '../models/listing'
import { apiRequest } from './httpClient'

const userPath = (userId: string) => `/api/v1/users/${encodeURIComponent(userId)}`

// Administración de usuarios, solo ADMIN (contracts/openapi/identity-service.yaml).
export const usersApi = {
  list: (params: { role?: Role; page: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page) })
    if (params.role) query.set('role', params.role)
    return apiRequest<Page<AdminUser>>(`/api/v1/users?${query}`, { auth: true, signal })
  },

  assignRoles: (userId: string, roles: Role[]) =>
    apiRequest<void>(`${userPath(userId)}/roles`, { method: 'PUT', body: { roles }, auth: true }),

  deactivate: (userId: string) =>
    apiRequest<void>(`${userPath(userId)}/deactivate`, { method: 'POST', auth: true }),

  activate: (userId: string) =>
    apiRequest<void>(`${userPath(userId)}/activate`, { method: 'POST', auth: true }),
}
