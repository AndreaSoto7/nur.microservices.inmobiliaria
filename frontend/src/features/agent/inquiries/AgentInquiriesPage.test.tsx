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
  it('lista quién consultó y sobre qué propiedad', async () => {
    routeFetch({ ...base(), [LIST]: listOf([summary]) })

    renderApp('/agente/consultas')

    const row = await screen.findByRole('listitem')
    expect(within(row).getByRole('heading', { name: 'María Pérez' })).toBeInTheDocument()
    expect(await within(row).findByRole('link', { name: 'Mi casa' })).toHaveAttribute(
      'href',
      `/agente/propiedades/${PROPERTY_ID}`,
    )
  })

  it('pide el mensaje solo al abrir la consulta y muestra cómo contactar', async () => {
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, full),
    })
    const user = userEvent.setup()
    renderApp('/agente/consultas')

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

  it('funciona sin teléfono, que es opcional', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, { ...full, contactPhone: undefined }),
    })
    const user = userEvent.setup()
    renderApp('/agente/consultas')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))

    await screen.findByText('¿Se permiten mascotas?')
    expect(screen.queryByText('Teléfono')).not.toBeInTheDocument()
  })

  it('se puede cerrar la consulta abierta', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(200, full),
    })
    const user = userEvent.setup()
    renderApp('/agente/consultas')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))
    await screen.findByText('¿Se permiten mascotas?')
    await user.click(screen.getByRole('button', { name: /^Ocultar consulta/ }))

    expect(screen.queryByText('¿Se permiten mascotas?')).not.toBeInTheDocument()
  })

  it('muestra el error si no se pudo abrir la consulta', async () => {
    routeFetch({
      ...base(),
      [LIST]: listOf([summary]),
      [DETAIL]: () => jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.')),
    })
    const user = userEvent.setup()
    renderApp('/agente/consultas')

    await user.click(await screen.findByRole('button', { name: /^Ver consulta/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
  })

  it('explica si todavía no recibió consultas', async () => {
    routeFetch({ ...base(), [LIST]: listOf([]) })

    renderApp('/agente/consultas')

    expect(await screen.findByText('Todavía no recibiste consultas')).toBeInTheDocument()
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
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
    renderApp('/agente/consultas')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no recibiste consultas')).toBeInTheDocument()
  })
})
