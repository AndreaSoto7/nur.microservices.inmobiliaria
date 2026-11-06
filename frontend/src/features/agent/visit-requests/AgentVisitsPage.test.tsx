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
  it('muestra el título de su propiedad aunque esté sin publicar', async () => {
    routeFetch(withVisit())

    renderApp('/agente/solicitudes')

    expect(await screen.findByRole('link', { name: 'Mi casa en borrador' })).toHaveAttribute(
      'href',
      `/agente/propiedades/${PROPERTY_ID}`,
    )
    expect(within(screen.getByRole('listitem')).getByText('Solicitada')).toBeInTheDocument()
  })

  it('programa una solicitud proponiendo la fecha del interesado, en UTC', async () => {
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
    renderApp('/agente/solicitudes')

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

  it('si el horario choca, lo dice en la fila y conserva el formulario abierto', async () => {
    routeFetch({
      ...withVisit(),
      [`POST ${action('schedule')}`]: () =>
        jsonResponse(409, problem(409, 'VISIT_SCHEDULE_CONFLICT', 'Ese horario ya está ocupado.')),
    })
    const user = userEvent.setup()
    renderApp('/agente/solicitudes')

    await user.click(await screen.findByRole('button', { name: /^Programar/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar horario' }))

    const row = screen.getByRole('listitem')
    expect(await within(row).findByRole('alert')).toHaveTextContent('Ese horario ya está ocupado.')
    expect(within(row).getByLabelText('Fecha y hora de la visita')).toBeInTheDocument()
  })

  it('rechaza una solicitud con su motivo', async () => {
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
    renderApp('/agente/solicitudes')

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

  it('no rechaza sin motivo, que el contrato exige', async () => {
    const fetchMock = routeFetch(withVisit())
    const user = userEvent.setup()
    renderApp('/agente/solicitudes')

    await user.click(await screen.findByRole('button', { name: /^Rechazar/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, rechazar' }))

    expect(screen.getByLabelText('Motivo')).toBeInvalid()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/reject'))).toBe(false)
  })

  it('cancela una visita programada', async () => {
    const fetchMock = routeFetch({
      ...withVisit(FUTURE),
      [`POST ${action('cancel')}`]: () => jsonResponse(200, { id: VISIT_ID, status: 'CANCELLED' }),
    })
    const user = userEvent.setup()
    renderApp('/agente/solicitudes')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', action('cancel'))).toEqual([{}]))
  })

  it('solo ofrece marcar como realizada cuando ya terminó el horario', async () => {
    routeFetch(withVisit(FUTURE))

    renderApp('/agente/solicitudes')

    await screen.findByRole('button', { name: /^Cancelar visita/ })
    expect(screen.queryByRole('button', { name: /^Marcar realizada/ })).not.toBeInTheDocument()
  })

  it('marca como realizada una visita que ya terminó', async () => {
    const fetchMock = routeFetch({
      ...withVisit(PAST),
      [`POST ${action('complete')}`]: () =>
        jsonResponse(200, { id: VISIT_ID, status: 'COMPLETED' }),
    })
    const user = userEvent.setup()
    renderApp('/agente/solicitudes')

    await user.click(await screen.findByRole('button', { name: /^Marcar realizada/ }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', action('complete'))).toEqual([{}]))
  })

  it.each(['COMPLETED', 'CANCELLED', 'REJECTED'] as const)(
    'una visita en estado %s no tiene acciones',
    async (status) => {
      routeFetch(withVisit({ status }))

      renderApp('/agente/solicitudes')

      const row = await screen.findByRole('listitem')
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('filtra por estado y explica el resultado vacío', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })
    const user = userEvent.setup()
    renderApp('/agente/solicitudes')

    expect(await screen.findByText('Todavía no recibiste solicitudes')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'REQUESTED')

    expect(await screen.findByText('No tienes visitas en estado Solicitada')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=REQUESTED'))).toBe(
      true,
    )
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
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
    renderApp('/agente/solicitudes')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no recibiste solicitudes')).toBeInTheDocument()
  })
})

describe('panel de agente', () => {
  it('reúne sus pantallas en un menú propio y marca dónde está', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, visitPage([])) })

    renderApp('/agente/solicitudes')

    const menu = await screen.findByRole('navigation', { name: 'Panel de agente' })
    expect(within(menu).getByRole('link', { name: 'Solicitudes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Mis propiedades' })).toHaveAttribute(
      'href',
      '/agente/propiedades',
    )
  })

  it('/agente lleva a sus propiedades', async () => {
    routeFetch({
      ...base(),
      'GET /api/v1/properties': () =>
        jsonResponse(200, {
          data: [],
          page: { number: 1, size: 20, totalElements: 0, totalPages: 0 },
        }),
    })

    renderApp('/agente')

    expect(await screen.findByRole('heading', { name: 'Mis propiedades' })).toBeInTheDocument()
  })

  it('la cabecera enlaza al panel solo para un agente', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, visitPage([])) })

    renderApp('/agente/solicitudes')

    expect(await screen.findByRole('link', { name: 'Panel de agente' })).toHaveAttribute(
      'href',
      '/agente',
    )
  })

  it('un interesado no puede entrar', async () => {
    routeFetch(sessionRoutes(currentUser))

    renderApp('/agente/solicitudes')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Panel de agente' })).not.toBeInTheDocument()
  })
})
