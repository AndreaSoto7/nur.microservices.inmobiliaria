import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  agentUser,
  currentUser,
  jsonResponse,
  problem,
  routeFetch,
  sessionRoutes,
} from '../../../test/http'
import { page, PROPERTY_ID, summary } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'

const LIST = 'GET /api/v1/properties'
const listWith =
  (...items: ReturnType<typeof summary>[]) =>
  () =>
    jsonResponse(200, page(items))

describe('AgentPropertiesPage', () => {
  it("lists the agent's properties with their status and price", async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith(summary({ status: 'DRAFT' })) })

    renderApp('/agent/properties')

    const row = await screen.findByRole('listitem')
    expect(
      within(row).getByRole('link', { name: 'Casa con jardín en Equipetrol' }),
    ).toHaveAttribute('href', `/agent/properties/${PROPERTY_ID}`)
    expect(within(row).getByText('Borrador')).toBeInTheDocument()
    expect(within(row).getByText('Bs 1.285.000')).toBeInTheDocument()
    expect(screen.getByText('1 propiedad')).toBeInTheDocument()
  })

  it('explains how to start when the agent has no properties', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agent/properties')

    expect(await screen.findByText('Todavía no tienes propiedades')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva propiedad' })).toHaveAttribute(
      'href',
      '/agent/properties/new',
    )
  })

  it('tells "no properties" apart from "none in that status"', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agent/properties?status=PAUSED')

    expect(await screen.findByText('No tienes propiedades en estado Pausada')).toBeInTheDocument()
  })

  it('filters by status from the URL and sends it to the API', async () => {
    const fetchMock = routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    await user.selectOptions(await screen.findByLabelText('Estado'), 'SOLD')

    await screen.findByText('No tienes propiedades en estado Vendida')
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(
      urls.some((url) => url.includes('/api/v1/properties?') && url.includes('status=SOLD')),
    ).toBe(true)
  })

  it('publishes a draft and fetches the list again', async () => {
    let status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: () => jsonResponse(200, page([summary({ status })])),
      [`POST /api/v1/properties/${PROPERTY_ID}/publish`]: () => {
        status = 'PUBLISHED'
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Publicada')).toBeInTheDocument(),
    )
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
  })

  it('asks for confirmation before marking as sold and allows backing out', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: listWith(summary()),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    await user.click(await screen.findByRole('button', { name: /^Marcar vendida/ }))
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, volver' }))

    expect(screen.queryByText(/no se puede deshacer/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/mark-sold'))).toBe(false)
  })

  it('marks as sold on confirmation', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: listWith(summary()),
      [`POST /api/v1/properties/${PROPERTY_ID}/mark-sold`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    await user.click(await screen.findByRole('button', { name: /^Marcar vendida/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, marcar vendida' }))

    await screen.findByRole('button', { name: /^Marcar vendida/ })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/mark-sold'))).toBe(true)
  })

  it('shows the problem+json detail when the transition fails', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: listWith(summary({ status: 'DRAFT' })),
      [`POST /api/v1/properties/${PROPERTY_ID}/publish`]: () =>
        jsonResponse(
          409,
          problem(409, 'PROPERTY_WITHOUT_IMAGES', 'Agrega al menos una foto antes de publicar.'),
        ),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Agrega al menos una foto antes de publicar.',
    )
  })

  it('shows the error and allows retrying when the list does not load', async () => {
    let attempts = 0
    routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.'))
          : jsonResponse(200, page([summary()]))
      },
    })
    const user = userEvent.setup()
    renderApp('/agent/properties')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('listitem')).toBeInTheDocument()
  })

  it('does not let a client in', async () => {
    routeFetch(sessionRoutes(currentUser))

    renderApp('/agent/properties')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
  })

  it("the dashboard menu links to the agent's properties", async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agent/properties')

    expect(await screen.findByRole('link', { name: 'Mis propiedades' })).toBeInTheDocument()
  })
})
