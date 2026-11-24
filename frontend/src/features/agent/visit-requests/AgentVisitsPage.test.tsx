import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
import { PROPERTY_ID } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'
import { visit, VISIT_ID, visitPage } from '../../../test/visitFixtures'
import type { Lead } from '../../../core/models/visit'
import { toLocalInputValue } from '../../../shared/format/date'

const LIST = 'GET /api/v1/visits'
const action = (name: string) => `/api/v1/visits/${VISIT_ID}/${name}`
const base = () => sessionRoutes(agentUser)
const withVisit = (overrides: Parameters<typeof visit>[0] = {}) => ({
  ...base(),
  [LIST]: () => jsonResponse(200, visitPage([visit(overrides)])),
})
const PAST = {
  status: 'SCHEDULED' as const,
  scheduledStart: '2020-01-15T14:00:00Z',
  scheduledEnd: '2020-01-15T15:00:00Z',
}
const CLASHING = {
  status: 'SCHEDULED' as const,
  scheduledStart: '2099-01-15T14:00:00Z',
  scheduledEnd: '2099-01-15T15:00:00Z',
}
const CLIENT_ID = '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const LEAD_ID = '05de258b-be6c-4f61-b6ac-ac67cc961b03'
const lead = (id: string, clientId: string): Lead => ({
  id,
  propertyId: PROPERTY_ID,
  clientId,
  status: 'OPEN',
  openedAt: '2026-10-16T14:30:00Z',
})
const leadPage = (items: Lead[]) => ({
  data: items,
  page: { number: 1, size: 20, totalElements: items.length, totalPages: 1 },
})
const FUTURE = {
  status: 'SCHEDULED' as const,
  scheduledStart: '2099-01-15T14:00:00Z',
  scheduledEnd: '2099-01-15T15:00:00Z',
}

describe('AgentVisitsPage', () => {
  it('shows the property title that comes with the visit', async () => {
    routeFetch(withVisit({ propertyTitle: 'Mi casa vendida' }))

    renderApp('/agent/visit-requests')

    expect(await screen.findByRole('link', { name: 'Mi casa vendida' })).toHaveAttribute(
      'href',
      `/properties/${PROPERTY_ID}`,
    )
    expect(within(screen.getByRole('listitem')).getByText('Solicitada')).toBeInTheDocument()
  })

  it("accepts a request at the client's date", async () => {
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

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Programada')).toBeInTheDocument(),
    )
    expect(sentBodies(fetchMock, 'POST', action('schedule'))).toEqual([
      { scheduledStart: '2099-01-15T14:30:00Z' },
    ])
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/schedule'))
    expect(call?.[1]?.headers).toHaveProperty('Idempotency-Key')
  })

  it('warns when the request clashes with a scheduled visit and does not let accept it', async () => {
    routeFetch({
      ...base(),
      [LIST]: (_init, url) =>
        jsonResponse(
          200,
          visitPage(
            url?.searchParams.get('status') === 'SCHEDULED'
              ? [visit({ ...CLASHING, id: 'otra', propertyTitle: 'Depto en el centro' })]
              : [visit()],
          ),
        ),
    })
    renderApp('/agent/visit-requests')

    const warning = await screen.findByText(/^Choca con tu visita en Depto en el centro/)
    const row = warning.closest('li') as HTMLElement
    expect(within(row).getByRole('button', { name: /^Aceptar/ })).toBeDisabled()
    expect(within(row).getByRole('button', { name: /^Proponer otro horario/ })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Próximas visitas' })).toBeInTheDocument()
  })

  it('if visit still finds a conflict, says so in the row', async () => {
    routeFetch({
      ...withVisit(),
      [`POST ${action('schedule')}`]: () =>
        jsonResponse(409, problem(409, 'VISIT_SCHEDULE_CONFLICT', 'Ese horario ya está ocupado.')),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))

    const row = screen.getByRole('listitem')
    expect(await within(row).findByRole('alert')).toHaveTextContent('Ese horario ya está ocupado.')
  })

  it('proposes another time to the client, in UTC', async () => {
    const fetchMock = routeFetch({
      ...withVisit(),
      [`POST ${action('propose-time')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'REQUESTED', proposedBy: 'AGENT' }),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Proponer otro horario/ }))
    fireEvent.change(screen.getByLabelText('Fecha y hora de la visita'), {
      target: { value: '2099-01-16T10:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST', action('propose-time'))).toEqual([
        { proposedAt: new Date('2099-01-16T10:00').toISOString() },
      ]),
    )
  })

  it('does not send a proposal that clashes with its agenda', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: (_init, url) =>
        jsonResponse(
          200,
          visitPage(
            url?.searchParams.get('status') === 'SCHEDULED'
              ? [visit({ ...CLASHING, id: 'otra' })]
              : [visit({ proposedAt: '2099-01-20T10:00:00Z' })],
          ),
        ),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await screen.findByRole('heading', { name: 'Próximas visitas' })
    await user.click(await screen.findByRole('button', { name: /^Proponer otro horario/ }))
    fireEvent.change(screen.getByLabelText('Fecha y hora de la visita'), {
      target: { value: toLocalInputValue(new Date('2099-01-15T14:30:00Z')) },
    })

    expect(screen.getByRole('status')).toHaveTextContent(/^Choca con tu visita/)
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/propose-time'))).toBe(false)
  })

  it('while the client has not answered its proposal, it cannot accept it itself', async () => {
    routeFetch(withVisit({ proposedBy: 'AGENT' }))

    renderApp('/agent/visit-requests')

    expect(await screen.findByText(/Esperando que el interesado responda/)).toBeInTheDocument()
    expect(screen.getByText('Tu propuesta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Cambiar propuesta/ })).toBeInTheDocument()
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

  it('completing a visit asks how the client ended up and closes the lead as won', async () => {
    const fetchMock = routeFetch({
      ...withVisit({ ...PAST, clientId: CLIENT_ID }),
      [`POST ${action('complete')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'COMPLETED' }),
      'GET /api/v1/leads': () =>
        jsonResponse(200, leadPage([lead('otro-lead', 'otro-cliente'), lead(LEAD_ID, CLIENT_ID)])),
      [`POST /api/v1/leads/${LEAD_ID}/close`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Visita realizada' })
    await user.click(await within(dialog).findByLabelText(/Cierra el trato/))
    await user.type(within(dialog).getByLabelText('Nota (opcional)'), 'Quiere reservar')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar y reservar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(sentBodies(fetchMock, 'POST', action('complete'))).toEqual([{}])
    expect(sentBodies(fetchMock, 'POST', `/api/v1/leads/${LEAD_ID}/close`)).toEqual([
      { outcome: 'WON', note: 'Quiere reservar' },
    ])
    const leadsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/v1/leads?'))
    expect(String(leadsCall?.[0])).toContain(`propertyId=${PROPERTY_ID}`)
    expect(String(leadsCall?.[0])).toContain('status=OPEN')
  })

  it('if the client is still interested, saves the note and leaves the lead open', async () => {
    const fetchMock = routeFetch({
      ...withVisit({ ...PAST, clientId: CLIENT_ID }),
      [`POST ${action('complete')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'COMPLETED' }),
      'GET /api/v1/leads': () => jsonResponse(200, leadPage([lead(LEAD_ID, CLIENT_ID)])),
      [`POST /api/v1/leads/${LEAD_ID}/follow-ups`]: () => jsonResponse(201, { id: 'nota' }),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Visita realizada' })
    expect(await within(dialog).findByLabelText(/Sigue interesado/)).toBeChecked()
    await user.type(within(dialog).getByLabelText('Nota (opcional)'), 'Vuelve con su pareja')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST', `/api/v1/leads/${LEAD_ID}/follow-ups`)).toEqual([
        { note: 'Vuelve con su pareja' },
      ]),
    )
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/close'))).toBe(false)
  })

  it('without an open lead with that client, only marks the visit as completed', async () => {
    const fetchMock = routeFetch({
      ...withVisit({ ...PAST, clientId: CLIENT_ID }),
      [`POST ${action('complete')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'COMPLETED' }),
      'GET /api/v1/leads': () => jsonResponse(200, leadPage([])),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Visita realizada' })
    expect(await within(dialog).findByText(/No hay una oportunidad abierta/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Nota (opcional)')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', action('complete'))).toEqual([{}]))
  })

  it('backing out of the dialog does not complete the visit', async () => {
    const fetchMock = routeFetch({
      ...withVisit({ ...PAST, clientId: CLIENT_ID }),
      'GET /api/v1/leads': () => jsonResponse(200, leadPage([])),
    })
    const user = userEvent.setup()
    renderApp('/agent/visit-requests')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/complete'))).toBe(false)
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
