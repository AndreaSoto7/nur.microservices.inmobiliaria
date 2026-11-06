import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Lead } from '../../../core/models/visit'
import {
  agentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../../test/http'
import { detail, PROPERTY_ID } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'

const LEAD_ID = '7c1f2a3b-4d5e-4f6a-8b7c-9d0e1f2a3b4c'
const LIST = 'GET /api/v1/leads'
const CLOSE = `/api/v1/leads/${LEAD_ID}/close`
const FOLLOW_UP = `/api/v1/leads/${LEAD_ID}/follow-ups`

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: LEAD_ID,
    propertyId: PROPERTY_ID,
    clientId: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    status: 'OPEN',
    openedAt: '2026-10-16T14:30:00Z',
    ...overrides,
  }
}
const listOf = (items: Lead[]) =>
  jsonResponse(200, {
    data: items,
    page: { number: 1, size: 20, totalElements: items.length, totalPages: 1 },
  })
const base = () => ({
  ...sessionRoutes(agentUser),
  [`GET /api/v1/properties/${PROPERTY_ID}`]: () => jsonResponse(200, detail({ title: 'Mi casa' })),
})

describe('AgentLeadsPage', () => {
  it('muestra la propiedad y el estado de cada oportunidad', async () => {
    routeFetch({ ...base(), [LIST]: () => listOf([lead()]) })

    renderApp('/agente/oportunidades')

    const row = await screen.findByRole('listitem')
    expect(await within(row).findByRole('link', { name: 'Mi casa' })).toBeInTheDocument()
    expect(within(row).getByText('Abierta')).toBeInTheDocument()
  })

  it.each([
    ['WON', 'Ganada'],
    ['LOST', 'Perdida'],
  ] as const)(
    'una oportunidad cerrada como %s dice %s y no tiene acciones',
    async (outcome, label) => {
      routeFetch({
        ...base(),
        [LIST]: () =>
          listOf([lead({ status: 'CLOSED', outcome, closedAt: '2026-10-17T14:30:00Z' })]),
      })

      renderApp('/agente/oportunidades')

      const row = await screen.findByRole('listitem')
      expect(within(row).getByText(label)).toBeInTheDocument()
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('registra una nota de seguimiento y confirma que se guardó', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => listOf([lead()]),
      [`POST ${FOLLOW_UP}`]: () => jsonResponse(201, { id: 'nota-1' }),
    })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    await user.click(await screen.findByRole('button', { name: /^Agregar nota/ }))
    await user.type(screen.getByLabelText('Nota'), '  Pidió más detalles  ')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('Nota guardada.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', FOLLOW_UP)).toEqual([{ note: 'Pidió más detalles' }])
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/follow-ups'))
    expect(call?.[1]?.headers).toHaveProperty('Idempotency-Key')
  })

  it('si la nota falla, lo dice en la fila y conserva lo escrito', async () => {
    routeFetch({
      ...base(),
      [LIST]: () => listOf([lead()]),
      [`POST ${FOLLOW_UP}`]: () =>
        jsonResponse(409, problem(409, 'LEAD_NOT_OPEN', 'La oportunidad ya está cerrada.')),
    })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    await user.click(await screen.findByRole('button', { name: /^Agregar nota/ }))
    await user.type(screen.getByLabelText('Nota'), 'Hola')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    const row = screen.getByRole('listitem')
    expect(await within(row).findByRole('alert')).toHaveTextContent('ya está cerrada')
    expect(within(row).getByLabelText('Nota')).toHaveValue('Hola')
  })

  it('cierra como ganada con nota y avisa que la reserva llega después', async () => {
    let closed = false
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => listOf([closed ? lead({ status: 'CLOSED', outcome: 'WON' }) : lead()]),
      [`POST ${CLOSE}`]: () => {
        closed = true
        return jsonResponse(200, { id: LEAD_ID, status: 'CLOSED', outcome: 'WON' })
      },
    })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    await user.click(await screen.findByRole('button', { name: /^Cerrar oportunidad/ }))
    await user.click(screen.getByRole('radio', { name: 'Ganada' }))
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Confirmó')
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Ganada')).toBeInTheDocument(),
    )
    expect(screen.getByText(/queda reservada en unos instantes/)).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', CLOSE)).toEqual([{ outcome: 'WON', note: 'Confirmó' }])
  })

  it('cerrar como perdida no promete una reserva y omite la nota vacía', async () => {
    let closed = false
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => listOf([closed ? lead({ status: 'CLOSED', outcome: 'LOST' }) : lead()]),
      [`POST ${CLOSE}`]: () => {
        closed = true
        return jsonResponse(200, { id: LEAD_ID, status: 'CLOSED', outcome: 'LOST' })
      },
    })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    await user.click(await screen.findByRole('button', { name: /^Cerrar oportunidad/ }))
    await user.click(screen.getByRole('radio', { name: 'Perdida' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Perdida')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/queda reservada/)).not.toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', CLOSE)).toEqual([{ outcome: 'LOST' }])
  })

  it('exige elegir el resultado antes de cerrar', async () => {
    const fetchMock = routeFetch({ ...base(), [LIST]: () => listOf([lead()]) })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    await user.click(await screen.findByRole('button', { name: /^Cerrar oportunidad/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/close'))).toBe(false)
  })

  it('filtra por estado y explica el resultado vacío', async () => {
    const fetchMock = routeFetch({ ...base(), [LIST]: () => listOf([]) })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    expect(await screen.findByText('Todavía no tienes oportunidades')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'CLOSED')

    expect(await screen.findByText('No tienes oportunidades en estado Cerrada')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=CLOSED'))).toBe(true)
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
    let attempts = 0
    routeFetch({
      ...base(),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : listOf([])
      },
    })
    const user = userEvent.setup()
    renderApp('/agente/oportunidades')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no tienes oportunidades')).toBeInTheDocument()
  })
})
