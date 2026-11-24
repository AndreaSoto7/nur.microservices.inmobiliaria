import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AppNotification } from '../../core/models/notification'
import { currentUser, jsonResponse, routeFetch, sessionRoutes } from '../../test/http'
import { renderApp } from '../../test/renderApp'

const reply: AppNotification = {
  id: '5b1e4c2a-9d3f-4a6b-8c21-0f5e6d7c8b9a',
  type: 'INQUIRY_REPLIED',
  message: 'El agente respondió tu consulta.',
  propertyId: null,
  visitId: null,
  createdAt: '2026-11-24T15:00:00Z',
  readAt: null,
}

const routes = (items: AppNotification[]) => ({
  ...sessionRoutes(currentUser),
  'GET /api/v1/catalog/properties': () =>
    jsonResponse(200, { data: [], page: { number: 1, size: 12, totalElements: 0, totalPages: 0 } }),
  'GET /api/v1/notifications': () =>
    jsonResponse(200, {
      data: items,
      page: { number: 1, size: 5, totalElements: items.length, totalPages: 1 },
    }),
})

describe('new notification announcement', () => {
  it('announces an unread notification with a title for its kind and a link to it', async () => {
    routeFetch(routes([reply]))

    renderApp('/')

    const title = await screen.findByText('Respondieron tu consulta')
    const toast = title.closest('[role="status"]') as HTMLElement
    expect(within(toast).getByText('El agente respondió tu consulta.')).toBeInTheDocument()
    expect(within(toast).getByRole('link', { name: 'Ver la respuesta' })).toHaveAttribute(
      'href',
      '/my-inquiries',
    )
  })

  it('does not announce it again after reloading', async () => {
    routeFetch(routes([reply]))
    const first = renderApp('/')
    await screen.findByText('Respondieron tu consulta')
    first.unmount()

    routeFetch(routes([reply]))
    renderApp('/')

    await screen.findByRole('link', { name: 'Avisos, 1 sin leer' })
    expect(screen.queryByText('Respondieron tu consulta')).not.toBeInTheDocument()
  })

  it('can be closed', async () => {
    routeFetch(routes([reply]))
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Cerrar aviso' }))

    await screen.findByRole('link', { name: 'Avisos, 1 sin leer' })
    expect(await screen.findByText('Respondieron tu consulta')).toHaveClass('toast__title')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.queryByText('Respondieron tu consulta')).not.toBeInTheDocument()
  })

  it('stays quiet on the notifications page, where they are already in view', async () => {
    routeFetch(routes([reply]))

    renderApp('/notifications')

    await screen.findByRole('heading', { name: 'Avisos' })
    await screen.findByText('El agente respondió tu consulta.')
    expect(screen.queryByText('Respondieron tu consulta')).not.toBeInTheDocument()
  })
})
