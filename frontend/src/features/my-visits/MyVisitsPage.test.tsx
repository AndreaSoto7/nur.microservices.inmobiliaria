import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  agentUser,
  currentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../test/http'
import { PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'
import { visit, VISIT_ID, visitPage } from '../../test/visitFixtures'

const LIST = 'GET /api/v1/visits'
const CANCEL_PATH = `/api/v1/visits/${VISIT_ID}/cancel`

describe('MyVisitsPage', () => {
  it('shows the status and the property title, with a link to its page', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit()])),
    })

    renderApp('/my-visits')

    const link = await screen.findByRole('link', { name: 'Casa con jardín en Equipetrol' })
    expect(link).toHaveAttribute('href', `/properties/${PROPERTY_ID}`)
    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Solicitada')).toBeInTheDocument()
    expect(within(row).getByText('Fecha propuesta')).toBeInTheDocument()
  })

  it('keeps the title when the property is no longer in the catalog', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'CANCELLED' })])),
    })

    renderApp('/my-visits')

    expect(await screen.findByText('Casa con jardín en Equipetrol')).toBeInTheDocument()
    expect(screen.queryByText('Propiedad no disponible')).not.toBeInTheDocument()
  })

  it('without a title, says the property is unavailable and does not link', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ propertyTitle: undefined })])),
    })

    renderApp('/my-visits')

    const row = await screen.findByRole('listitem')
    expect(await within(row).findByText('Propiedad no disponible')).toBeInTheDocument()
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the slot of a scheduled visit', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () =>
        jsonResponse(
          200,
          visitPage([
            visit({
              status: 'SCHEDULED',
              scheduledStart: '2099-01-16T15:00:00Z',
              scheduledEnd: '2099-01-16T16:00:00Z',
            }),
          ]),
        ),
    })

    renderApp('/my-visits')

    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('Programada')).toBeInTheDocument()
    expect(within(row).getByText('Horario')).toBeInTheDocument()
  })

  it('shows the reason for a rejection', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () =>
        jsonResponse(
          200,
          visitPage([visit({ status: 'REJECTED', resolutionReason: 'La propiedad se reservó.' })]),
        ),
    })

    renderApp('/my-visits')

    expect(await screen.findByText('La propiedad se reservó.')).toBeInTheDocument()
  })

  it.each([
    ['PROPERTY_RESERVED', 'La propiedad fue reservada.'],
    ['PROPERTY_UNAVAILABLE', 'La propiedad ya no está disponible.'],
  ])('shows the system reason %s in Spanish', async (resolutionReason, text) => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'REJECTED', resolutionReason })])),
    })

    renderApp('/my-visits')

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(resolutionReason)).not.toBeInTheDocument()
  })

  it.each(['REQUESTED', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const)(
    'a visit in status %s cannot be cancelled',
    async (status) => {
      routeFetch({
        ...sessionRoutes(currentUser),
        [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      })

      renderApp('/my-visits')

      await screen.findByRole('listitem')
      expect(screen.queryByRole('button', { name: /^Cancelar visita/ })).not.toBeInTheDocument()
    },
  )

  it('cancels a scheduled visit with a reason and refreshes the list', async () => {
    let status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED'
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      [`POST ${CANCEL_PATH}`]: () => {
        status = 'CANCELLED'
        return jsonResponse(200, { id: VISIT_ID, status })
      },
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.type(screen.getByLabelText('Motivo (opcional)'), '  Surgió un imprevisto  ')
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Cancelada')).toBeInTheDocument(),
    )
    expect(sentBodies(fetchMock, 'POST', CANCEL_PATH)).toEqual([{ reason: 'Surgió un imprevisto' }])
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/cancel'))
    expect(call?.[1]?.headers).toHaveProperty('Idempotency-Key')
  })

  it('cancelling without a reason sends an empty body', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
      [`POST ${CANCEL_PATH}`]: () => jsonResponse(200, { id: VISIT_ID, status: 'CANCELLED' }),
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', CANCEL_PATH)).toEqual([{}]))
  })

  it('allows backing out without calling the API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'No, volver' }))

    expect(screen.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/cancel'))).toBe(false)
  })

  it('shows the reason when it is too late to cancel', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
      [`POST ${CANCEL_PATH}`]: () =>
        jsonResponse(409, problem(409, 'VISIT_CANCELLATION_TOO_LATE', 'La visita ya empezó.')),
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La visita ya empezó.')
  })

  it('filters by status and sends it to the API, sorting by most recent', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    await user.selectOptions(await screen.findByLabelText('Estado'), 'SCHEDULED')

    expect(await screen.findByText('No tienes visitas en estado Programada')).toBeInTheDocument()
    const urls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes('/visits'))
    expect(urls.some((url) => url.includes('status=SCHEDULED'))).toBe(true)
    expect(urls.every((url) => url.includes('sort=requestedAt%2Cdesc'))).toBe(true)
  })

  it('explains what to do when there are no visits', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })

    renderApp('/my-visits')

    expect(await screen.findByText('Todavía no solicitaste visitas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
  })

  it('shows the error and allows retrying when the list does not load', async () => {
    let attempts = 0
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : jsonResponse(200, visitPage([]))
      },
    })
    const user = userEvent.setup()
    renderApp('/my-visits')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no solicitaste visitas')).toBeInTheDocument()
  })

  it('the link shows up for a client and an agent cannot get in', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })

    renderApp('/my-visits')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mis visitas' })).not.toBeInTheDocument()
  })
})
