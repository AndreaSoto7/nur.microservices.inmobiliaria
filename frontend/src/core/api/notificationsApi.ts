import type { NotificationPage } from '../models/notification'
import { apiRequest } from './httpClient'

// Avisos de quien tiene la sesión (contracts/openapi/notification-service.yaml).
export const notificationsApi = {
  list: (params: { page: number; size: number; unread: boolean }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
    if (params.unread) query.set('unread', 'true')
    return apiRequest<NotificationPage>(`/api/v1/notifications?${query}`, { auth: true, signal })
  },

  markRead: (notificationId: string) =>
    apiRequest<void>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      body: { read: true },
      auth: true,
    }),
}
