import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockFetch, problem } from '../../test/http'
import { detail, page, PROPERTY_ID, summary } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

function requestedQuery(fetchMock: ReturnType<typeof mockFetch>, call: number): URLSearchParams {
  const url = String(fetchMock.mock.calls[call][0])
  return new URL(url).searchParams
}

describe('public catalog', () => {
  it('shows the catalog properties with price, type, zone and cover', async () => {
    mockFetch(
      jsonResponse(
        200,
        page([summary(), summary({ id: 'otra', title: 'Depto céntrico', status: 'RESERVED' })]),
      ),
    )

    renderApp('/')

    const list = await screen.findByRole('list', { name: 'Propiedades' })
    expect(within(list).getAllByRole('article')).toHaveLength(2)
    expect(screen.getAllByText('Bs 1.285.000')).toHaveLength(2)
    expect(screen.getAllByText(/Casa en venta · Equipetrol/)).toHaveLength(2)
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Casa con jardín en Equipetrol' })).toHaveAttribute(
      'src',
      `http://localhost:8080/api/v1/properties/${PROPERTY_ID}/images/5a1f0c2e-7b3d-4e6f-9a10-1b2c3d4e5f60`,
    )
    expect(screen.getByText('2 propiedades')).toBeInTheDocument()
  })

  it('uses the URL filters when querying the catalog', async () => {
    const fetchMock = mockFetch(jsonResponse(200, page([summary()])))

    renderApp('/?zone=Equipetrol&operation=RENT&features=POOL,GARAGE&page=2')

    await screen.findByRole('list', { name: 'Propiedades' })
    const query = requestedQuery(fetchMock, 0)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/catalog/properties?')
    expect(query.get('zone')).toBe('Equipetrol')
    expect(query.get('operation')).toBe('RENT')
    expect(query.get('features')).toBe('POOL,GARAGE')
    expect(query.get('page')).toBe('2')
    expect(query.get('size')).toBe('12')
    expect(screen.getByLabelText('Zona')).toHaveValue('Equipetrol')
  })

  it('searching with filters goes back to page 1 and fetches the new results', async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, page([summary()], { totalPages: 3, totalElements: 30 })),
      jsonResponse(200, page([summary({ id: 'filtrada', title: 'Con piscina' })])),
    )
    const user = userEvent.setup()
    renderApp('/?page=2')
    await screen.findByRole('list', { name: 'Propiedades' })

    await user.type(screen.getByLabelText('Zona'), 'Urubó')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'APARTMENT')
    await user.click(screen.getByLabelText('Piscina'))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Con piscina')).toBeInTheDocument()
    const query = requestedQuery(fetchMock, 1)
    expect(query.get('zone')).toBe('Urubó')
    expect(query.get('type')).toBe('APARTMENT')
    expect(query.get('features')).toBe('POOL')
    expect(query.get('page')).toBe('1')
  })

  it('paginates with Siguiente', async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, page([summary()], { number: 1, totalPages: 2, totalElements: 13 })),
      jsonResponse(
        200,
        page([summary({ id: 'p2', title: 'De la página 2' })], { number: 2, totalPages: 2 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/')
    await screen.findByText('Página 1 de 2')

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('De la página 2')).toBeInTheDocument()
    expect(requestedQuery(fetchMock, 1).get('page')).toBe('2')
  })

  it('if the cover photo does not load shows "Sin foto" instead of a broken image', async () => {
    mockFetch(jsonResponse(200, page([summary({ bathrooms: 1, bedrooms: 1 })])))
    renderApp('/')

    fireEvent.error(await screen.findByRole('img', { name: 'Casa con jardín en Equipetrol' }))

    expect(screen.getByText('Sin foto')).toBeInTheDocument()
    expect(screen.getByText('1 dormitorio · 1 baño · 240.5 m²')).toBeInTheDocument()
  })

  it('shows an empty state when there are no results', async () => {
    mockFetch(jsonResponse(200, page([])))

    renderApp('/?zone=Ninguna')

    expect(await screen.findByText('No hay propiedades con esos filtros')).toBeInTheDocument()
  })

  it('without filters, the empty state does not mention filters', async () => {
    mockFetch(jsonResponse(200, page([])))

    renderApp('/')

    expect(await screen.findByText('Todavía no hay propiedades publicadas')).toBeInTheDocument()
    expect(screen.queryByText('No hay propiedades con esos filtros')).not.toBeInTheDocument()
  })

  it('changing the sort applies immediately and goes back to page 1', async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, page([summary()], { number: 2, totalPages: 2 })),
      jsonResponse(200, page([summary({ title: 'La más barata' })])),
    )
    const user = userEvent.setup()
    renderApp('/?page=2')
    await screen.findByRole('list', { name: 'Propiedades' })

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'price,asc')

    expect(await screen.findByText('La más barata')).toBeInTheDocument()
    const query = requestedQuery(fetchMock, 1)
    expect(query.get('sort')).toBe('price,asc')
    expect(query.get('page')).toBe('1')
  })

  it('opens "Más filtros" and offers clearing only when filters are applied', async () => {
    mockFetch(jsonResponse(200, page([summary()])))

    renderApp('/?minPrice=1000&features=POOL')
    await screen.findByRole('list', { name: 'Propiedades' })

    expect(screen.getByText('Más filtros (2)').closest('details')).toHaveAttribute('open')
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('without filters, "Más filtros" stays closed and does not offer clearing', async () => {
    mockFetch(jsonResponse(200, page([summary()])))

    renderApp('/')
    await screen.findByRole('list', { name: 'Propiedades' })

    expect(screen.getByText('Más filtros').closest('details')).not.toHaveAttribute('open')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('shows the problem+json error and allows retrying', async () => {
    mockFetch(
      jsonResponse(503, problem(503, 'GATEWAY_UNAVAILABLE', 'El servicio no está disponible.')),
      jsonResponse(200, page([summary()])),
    )
    const user = userEvent.setup()
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio no está disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('list', { name: 'Propiedades' })).toBeInTheDocument()
  })

  it('the card leads to the property detail', async () => {
    mockFetch(jsonResponse(200, page([summary()])), jsonResponse(200, detail()))
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: /Casa con jardín en Equipetrol/ }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Casa con jardín en Equipetrol',
      ),
    )
    expect(screen.getByText('Calle 7 Oeste #120', { exact: false })).toBeInTheDocument()
  })
})
