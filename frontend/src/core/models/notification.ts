import type { Page } from './listing'

// Reflejo de contracts/openapi/notification-service.yaml. No agregues campos que no estén ahí.

/** Se llama así para no chocar con la `Notification` del navegador. */
export interface AppNotification {
  id: string
  /** `string` y no un enum: el contrato pide tolerar tipos nuevos. El texto ya viene en `message`. */
  type: string
  message: string
  propertyId: string | null
  visitId: string | null
  createdAt: string
  readAt: string | null
}

export type NotificationPage = Page<AppNotification>
