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
} from '../../../test/http'
import { detail, PROPERTY_ID } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'
import { visit, VISIT_ID, visitPage } from '../../../test/visitFixtures'

const LIST = 'GET /api/v1/visits'
const OWN_PROPERTY = `GET /api/v1/properties/${PROPERTY_ID}`
const action = (name: string) => `/api/v1/visits/${VISIT_ID}/${name}`
const base = () => ({
  ...sessionRoutes(agentUser),
  [OWN_PROPERTY]: () =>
    jsonResponse(200, detail({ status: 'DRAFT', title: 'Mi casa en borrador' })),
})
const withVisit = (overrides: Parameters<typeof visit>[0] = {}) => ({
  ...base(),
  [LIST]: () => jsonResponse(200, visitPage([visit(overrides)])),
})
const PAST = {
  status: 'SCHEDULED' as const,
  scheduledStart: '2020-01-15T14:00:00Z',
  scheduledEnd: '2020-01-15T15:00:00Z',
}
const FUTURE = {
  status: 'SCHEDULED' as const,
  scheduledStart: '2099-01-15T14:00:00Z',
  scheduledEnd: '2099-01-15T15:00:00Z',
}

describe('AgentVisitsPage', () => {
  it("shows the title of the agent's property even if unpublished", async () => {
    routeFetch(withVisit())

    renderApp('/agent/visit-requests')

    expect(await screen.findByRole('link', { name: 'Mi casa en borrador' })).toHaveAttribute(
      'href',
      `/agent/properties/${PROPERTY_ID}`,
    )
    expect(within(screen.getByRole('listitem')).getByText('Solicitada')).toBeInTheDocument()
  })

  it("schedules a request proposing the client's date, in UTC", async () => {
    let status: 'REQUESTED' | 'SCHEDULED' = 'REQUESTED'
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      [`POST ${action('schedule')}`]: () => {
        status = 'SCHEDULED'
        return jsonResponse(200, { id: VISIT_ID, status })
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Programar/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar horario' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Programada')).toBeInTheDocument(),
    )
    expect(sentBodies(fetchMock, 'POST', action('schedule'))).toEqual([
      { scheduledStart: new Date('2099-01-15T14:30:00Z').toISOString() },
    ])
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/schedule'))
    expect(call?.[1]?.headers).toHaveProperty('Idempotency-Key')
  })

  it('if the slot conflicts, says so in the row and keeps the form open', async () => {
    routeFetch({
      ...withVisit(),
      [`POST ${action('schedule')}`]: () =>
        jsonResponse(409, problem(409, 'VISIT_SCHEDULE_CONFLICT', 'Ese horario ya está ocupado.')),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Programar/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar horario' }))

    const row = screen.getByRole('listitem')
    expect(await within(row).findByRole('alert')).toHaveTextContent('Ese horario ya está ocupado.')
    expect(within(row).getByLabelText('Fecha y hora de la visita')).toBeInTheDocument()
  })

  it('rejects a request with its reason', async () => {
    let status: 'REQUESTED' | 'REJECTED' = 'REQUESTED'
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      [`POST ${action('reject')}`]: () => {
        status = 'REJECTED'
        return jsonResponse(200, { id: VISIT_ID, status })
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Rechazar/ }))
    await user.type(screen.getByLabelText('Motivo'), 'Ya no está disponible ese día')
    await user.click(screen.getByRole('button', { name: 'Sí, rechazar' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Rechazada')).toBeInTheDocument(),
    )
    expect(sentBodies(fetchMock, 'POST', action('reject'))).toEqual([
      { reason: 'Ya no está disponible ese día' },
    ])
  })

  it('does not reject without a reason, which the contract requires', async () => {
    const fetchMock = routeFetch(withVisit())
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Rechazar/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, rechazar' }))

    expect(screen.getByLabelText('Motivo')).toBeInvalid()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/reject'))).toBe(false)
  })

  it('cancels a scheduled visit', async () => {
    const fetchMock = routeFetch({
      ...withVisit(FUTURE),
      [`POST ${action('cancel')}`]: () => jsonResponse(200, { id: VISIT_ID, status: 'CANCELLED' }),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', action('cancel'))).toEqual([{}]))
  })

  it('only offers marking as completed once the slot has ended', async () => {
    routeFetch(withVisit(FUTURE))

    renderApp('/agent/visit-requests')

    await screen.findByRole('button', { name: /^Cancelar visita/ })
    expect(screen.queryByRole('button', { name: /^Marcar realizada/ })).not.toBeInTheDocument()
  })

  it('marks as completed a visit that already ended', async () => {
    const fetchMock = routeFetch({
      ...withVisit(PAST),
      [`POST ${action('complete')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'COMPLETED' }),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', action('complete'))).toEqual([{}]))
  })

  it.each(['COMPLETED', 'CANCELLED', 'REJECTED'] as const)(
    'a visit in status %s has no actions',
    async (status) => {
      routeFetch(withVisit({ status }))

      renderApp('/agent/visit-requests')

      const row = await screen.findByRole('listitem')
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('filters by status and explains the empty result', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    expect(await screen.findByText('Todavía no recibiste solicitudes')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'REQUESTED')

    expect(await screen.findByText('No tienes visitas en estado Solicitada')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=REQUESTED'))).toBe(
      true,
    )
  })

  it('shows the error and allows retrying when the list does not load', async () => {
    let attempts = 0
    routeFetch({
      ...base(),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : jsonResponse(200, visitPage([]))
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no recibiste solicitudes')).toBeInTheDocument()
  })
})

describe('agent dashboard', () => {
  it('groups its screens in its own menu and highlights the current one', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, visitPage([])) })

    renderApp('/agent/visit-requests')

    const menu = await screen.findByRole('navigation', { name: 'Panel de agente' })
    expect(within(menu).getByRole('link', { name: 'Solicitudes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Mis propiedades' })).toHaveAttribute(
      'href',
      '/agent/properties',
    )
  })

  it("/agent leads to the agent's properties", async () => {
    routeFetch({
      ...base(),
      'GET /api/v1/properties': () =>
        jsonResponse(200, {
          data: [],
          page: { number: 1, size: 20, totalElements: 0, totalPages: 0 },
        }),
    })

    renderApp('/agent')

    expect(await screen.findByRole('heading', { name: 'Mis propiedades' })).toBeInTheDocument()
  })

  it('the header links to the dashboard only for an agent', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, visitPage([])) })

    renderApp('/agent/visit-requests')

    expect(await screen.findByRole('link', { name: 'Panel de agente' })).toHaveAttribute(
      'href',
      '/agent',
    )
  })

  it('a client cannot get in', async () => {
    routeFetch(sessionRoutes(currentUser))

    renderApp('/agent/visit-requests')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Panel de agente' })).not.toBeInTheDocument()
  })
})
