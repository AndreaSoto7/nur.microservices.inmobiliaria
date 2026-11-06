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
  it('lista las propiedades del agente con su estado y su precio', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith(summary({ status: 'DRAFT' })) })

    renderApp('/agente/propiedades')

    const row = await screen.findByRole('listitem')
    expect(
      within(row).getByRole('link', { name: 'Casa con jardín en Equipetrol' }),
    ).toHaveAttribute('href', `/agente/propiedades/${PROPERTY_ID}`)
    expect(within(row).getByText('Borrador')).toBeInTheDocument()
    expect(within(row).getByText('Bs 1.285.000')).toBeInTheDocument()
    expect(screen.getByText('1 propiedad')).toBeInTheDocument()
  })

  it('explica cómo empezar si el agente no tiene propiedades', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agente/propiedades')

    expect(await screen.findByText('Todavía no tienes propiedades')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva propiedad' })).toHaveAttribute(
      'href',
      '/agente/propiedades/nueva',
    )
  })

  it('distingue "sin propiedades" de "ninguna en ese estado"', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agente/propiedades?status=PAUSED')

    expect(await screen.findByText('No tienes propiedades en estado Pausada')).toBeInTheDocument()
  })

  it('filtra por estado desde la URL y lo manda a la API', async () => {
    const fetchMock = routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })
    const user = userEvent.setup()
    renderApp('/agente/propiedades')

    await user.selectOptions(await screen.findByLabelText('Estado'), 'SOLD')

    await screen.findByText('No tienes propiedades en estado Vendida')
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(
      urls.some((url) => url.includes('/api/v1/properties?') && url.includes('status=SOLD')),
    ).toBe(true)
  })

  it('publica un borrador y vuelve a consultar la lista', async () => {
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
    renderApp('/agente/propiedades')

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Publicada')).toBeInTheDocument(),
    )
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
  })

  it('pide confirmación antes de marcar como vendida y permite arrepentirse', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: listWith(summary()),
    })
    const user = userEvent.setup()
    renderApp('/agente/propiedades')

    await user.click(await screen.findByRole('button', { name: /^Marcar vendida/ }))
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, volver' }))

    expect(screen.queryByText(/no se puede deshacer/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/mark-sold'))).toBe(false)
  })

  it('marca como vendida al confirmar', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: listWith(summary()),
      [`POST /api/v1/properties/${PROPERTY_ID}/mark-sold`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp('/agente/propiedades')

    await user.click(await screen.findByRole('button', { name: /^Marcar vendida/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, marcar vendida' }))

    await screen.findByRole('button', { name: /^Marcar vendida/ })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/mark-sold'))).toBe(true)
  })

  it('muestra el detail del problem+json si la transición falla', async () => {
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
    renderApp('/agente/propiedades')

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Agrega al menos una foto antes de publicar.',
    )
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
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
    renderApp('/agente/propiedades')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('listitem')).toBeInTheDocument()
  })

  it('no deja entrar a un interesado', async () => {
    routeFetch(sessionRoutes(currentUser))

    renderApp('/agente/propiedades')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
  })

  it('muestra el enlace a sus propiedades solo a un agente', async () => {
    routeFetch({ ...sessionRoutes(agentUser), [LIST]: listWith() })

    renderApp('/agente/propiedades')

    expect(await screen.findByRole('link', { name: 'Mis propiedades' })).toBeInTheDocument()
  })
})
