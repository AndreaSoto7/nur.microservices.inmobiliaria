import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { agentUser, jsonResponse, problem, routeFetch, sessionRoutes } from '../../../test/http'
import { detail, PROPERTY_ID } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'

const INQUIRY_ID = '05de258b-be6c-4f61-b6ac-ac67cc961b03'
const LIST = 'GET /api/v1/inquiries'
const DETAIL = `GET /api/v1/inquiries/${INQUIRY_ID}`
const summary = {
  id: INQUIRY_ID,
  propertyId: PROPERTY_ID,
  contactName: 'María Pérez',
  createdAt: '2026-10-16T14:30:00Z',
}
const full = {
  ...summary,
  contactEmail: 'maria@example.com',
  contactPhone: '70000000',
  message: '¿Se permiten mascotas?',
}
const listOf = (items: (typeof summary)[]) => () =>
  jsonResponse(200, {
    data: items,
    page: { number: 1, size: 20, totalElements: items.length, totalPages: 1 },
  })
const base = () => ({
  ...sessionRoutes(agentUser),
  [`GET /api/v1/properties/${PROPERTY_ID}`]: () => jsonResponse(200, detail({ title: 'Mi casa' })),
})

describe('AgentInquiriesPage', () => {
  it('lists who asked and about which property', async () => {
    routeFetch({ ...base(), [LIST]: listOf([summary]) })

    renderApp('/agent/inquiries')

    const row = await screen.findByRole('listitem')
    expect(within(row).getByRole('heading', { name: 'María Pérez' })).toBeInTheDocument()
    expect(await within(row).findByRole('link', { name: 'Mi casa' })).toHaveAttribute(
      'href',
      `/agent/properties/${PROPERTY_ID}`,
    )
  })

  it('fetches the message only when opening the inquiry and shows how to get in touch', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, full),
    })
    const user = userEvent.setup()
    renderApp('/agent/inquiries')

    const toggle = await screen.findByRole('button', { name: /^Ver consulta/ })
    const asked = () =>
      fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/inquiries/${INQUIRY_ID}`))
    expect(asked()).toBe(false)
    await user.click(toggle)

    expect(await screen.findByText('¿Se permiten mascotas?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'maria@example.com' })).toHaveAttribute(
      'href',
      'mailto:maria@example.com',
    )
    expect(screen.getByRole('link', { name: '70000000' })).toHaveAttribute('href', 'tel:70000000')
  })

  it('works without phone, which is optional', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, { ...full, contactPhone: undefined }),
    })
    const user = userEvent.setup()
    renderApp('/agent/inquiries')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))

    await screen.findByText('¿Se permiten mascotas?')
    expect(screen.queryByText('Teléfono')).not.toBeInTheDocument()
  })

  it('the open inquiry can be closed', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, full),
    })
    const user = userEvent.setup()
    renderApp('/agent/inquiries')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))
    await screen.findByText('¿Se permiten mascotas?')
    await user.click(screen.getByRole('button', { name: /^Ocultar consulta/ }))

    expect(screen.queryByText('¿Se permiten mascotas?')).not.toBeInTheDocument()
  })

  it('shows the error when the inquiry could not be opened', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.')),
    })
    const user = userEvent.setup()
    renderApp('/agent/inquiries')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
  })

  it('explains when no inquiries have been received yet', async () => {
    routeFetch({ ...base(), [LIST]: listOf([]) })

    renderApp('/agent/inquiries')

    expect(await screen.findByText('Todavía no recibiste consultas')).toBeInTheDocument()
  })

  it('shows the error and allows retrying when the list does not load', async () => {
    let attempts = 0
    routeFetch({
      ...base(),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : listOf([])()
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/inquiries')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no recibiste consultas')).toBeInTheDocument()
  })
})
