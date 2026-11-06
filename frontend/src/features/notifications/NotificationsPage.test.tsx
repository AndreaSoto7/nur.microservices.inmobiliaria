import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AppNotification } from '../../core/models/notification'
import { currentUser, jsonResponse, problem, routeFetch, sessionRoutes } from '../../test/http'
import { PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/notifications'
const NOTIFICATION_ID = '7b1e4c2a-9d3f-4a6b-8c21-0f5e6d7c8b9a'

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: NOTIFICATION_ID,
    type: 'VISIT_REQUESTED',
    message: 'Recibiste una nueva solicitud de visita.',
    propertyId: PROPERTY_ID,
    visitId: null,
    createdAt: '2026-10-16T14:30:00Z',
    readAt: null,
    ...overrides,
  }
}

const pageOf = (items: AppNotification[], meta: { number?: number; totalPages?: number } = {}) => ({
  data: items,
  page: { number: 1, size: 20, totalElements: items.length, totalPages: 1, ...meta },
})

describe('NotificationsPage', () => {
  it('muestra el aviso, marca que está sin leer y enlaza a la propiedad', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, pageOf([notification()])),
    })

    renderApp('/avisos')

    const item = await screen.findByRole('listitem')
    expect(within(item).getByText('Recibiste una nueva solicitud de visita.')).toBeInTheDocument()
    expect(within(item).getByText('Sin leer')).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: 'Ver propiedad' })).toHaveAttribute(
      'href',
      `/propiedades/${PROPERTY_ID}`,
    )
  })

  it('un aviso sin propiedad no ofrece el enlace', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () =>
        jsonResponse(200, pageOf([notification({ type: 'WELCOME', propertyId: null })])),
    })

    renderApp('/avisos')

    const item = await screen.findByRole('listitem')
    expect(within(item).queryByRole('link')).not.toBeInTheDocument()
  })

  it('muestra un tipo de aviso que todavía no conoce', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () =>
        jsonResponse(200, pageOf([notification({ type: 'TIPO_NUEVO', message: 'Algo nuevo.' })])),
    })

    renderApp('/avisos')

    expect(await screen.findByText('Algo nuevo.')).toBeInTheDocument()
  })

  it('marca un aviso como leído con el formato del contrato', async () => {
    let readAt: string | null = null
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, pageOf([notification({ readAt })])),
      [`PATCH /api/v1/notifications/${NOTIFICATION_ID}`]: () => {
        readAt = '2026-10-16T15:00:00Z'
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()
    renderApp('/avisos')

    await user.click(await screen.findByRole('button', { name: /^Marcar como leído/ }))

    await waitFor(() => expect(screen.queryByText('Sin leer')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Marcar como leído/ })).not.toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patch?.[1]?.body).toBe('{"read":true}')
  })

  it('muestra el error si no se pudo marcar como leído', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, pageOf([notification()])),
      [`PATCH /api/v1/notifications/${NOTIFICATION_ID}`]: () =>
        jsonResponse(404, problem(404, 'NOTIFICATION_NOT_FOUND', 'El aviso no existe.')),
    })
    const user = userEvent.setup()
    renderApp('/avisos')

    await user.click(await screen.findByRole('button', { name: /^Marcar como leído/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El aviso no existe.')
  })

  it('filtra los no leídos desde la URL y se lo pide a la API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, pageOf([])),
    })
    const user = userEvent.setup()
    renderApp('/avisos')

    await user.click(await screen.findByRole('checkbox', { name: 'Solo sin leer' }))

    expect(await screen.findByText('No tienes avisos sin leer')).toBeInTheDocument()
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.includes('page=1') && url.includes('unread=true'))).toBe(true)
  })

  it('distingue "sin avisos" de "sin avisos por leer"', async () => {
    routeFetch({ ...sessionRoutes(currentUser), [LIST]: () => jsonResponse(200, pageOf([])) })

    renderApp('/avisos')

    expect(await screen.findByText('Todavía no tienes avisos')).toBeInTheDocument()
  })

  it('lee la página de la URL', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, pageOf([notification()], { number: 2, totalPages: 3 })),
    })

    renderApp('/avisos?page=2')

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
    let attempts = 0
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => {
        attempts += 1
        return attempts <= 2
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : jsonResponse(200, pageOf([]))
      },
    })
    const user = userEvent.setup()
    renderApp('/avisos')

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no tienes avisos')).toBeInTheDocument()
  })

  it('sin sesión manda a ingresar', async () => {
    routeFetch({})

    renderApp('/avisos')

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
  })
})

describe('contador de avisos en la cabecera', () => {
  const withUnread = (total: number) => () =>
    jsonResponse(200, {
      data: [],
      page: { number: 1, size: 1, totalElements: total, totalPages: 1 },
    })

  it('dice cuántos avisos hay sin leer', async () => {
    routeFetch({ ...sessionRoutes(currentUser), [LIST]: withUnread(3) })

    renderApp('/cuenta')

    expect(await screen.findByRole('link', { name: 'Avisos, 3 sin leer' })).toHaveAttribute(
      'href',
      '/avisos',
    )
  })

  it('no muestra contador si no hay nada sin leer', async () => {
    routeFetch({ ...sessionRoutes(currentUser), [LIST]: withUnread(0) })

    renderApp('/cuenta')

    expect(await screen.findByRole('link', { name: 'Avisos' })).toBeInTheDocument()
  })

  it('si notification no responde, el enlace sigue ahí sin contador', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () =>
        jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.')),
    })

    renderApp('/cuenta')

    expect(await screen.findByRole('link', { name: 'Avisos' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin sesión no aparece ni se consulta', async () => {
    const fetchMock = routeFetch({
      'GET /api/v1/catalog/properties': () =>
        jsonResponse(200, {
          data: [],
          page: { number: 1, size: 12, totalElements: 0, totalPages: 0 },
        }),
    })

    renderApp('/')

    await screen.findByRole('link', { name: 'Ingresar' })
    expect(screen.queryByRole('link', { name: /^Avisos/ })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('notifications'))).toBe(false)
  })
})
