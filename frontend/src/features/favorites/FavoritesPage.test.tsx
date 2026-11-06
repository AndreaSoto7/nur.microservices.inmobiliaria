import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { currentUser, jsonResponse, problem, routeFetch, sessionRoutes } from '../../test/http'
import { PROPERTY_ID, summary } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/favorites'
const REMOVE = `DELETE /api/v1/favorites/${PROPERTY_ID}`
const favoritesPage = (
  items: ReturnType<typeof summary>[],
  meta: { number?: number; totalPages?: number } = {},
) => ({
  data: items.map((property) => ({ property, savedAt: '2026-10-16T14:30:00Z' })),
  page: { number: 1, size: 12, totalElements: items.length, totalPages: 1, ...meta },
})

describe('FavoritesPage', () => {
  it('lista los favoritos con enlace a su ficha', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, favoritesPage([summary()])),
    })

    renderApp('/favoritos')

    const link = await screen.findByRole('link', { name: /Casa con jardín en Equipetrol/ })
    expect(link).toHaveAttribute('href', `/propiedades/${PROPERTY_ID}`)
    expect(screen.getByRole('link', { name: 'Favoritos' })).toBeInTheDocument()
  })

  it('explica qué hacer si no hay favoritos', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, favoritesPage([])),
    })

    renderApp('/favoritos')

    expect(await screen.findByText('Todavía no tienes favoritos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
  })

  it('quita un favorito y actualiza la lista', async () => {
    let saved = true
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, favoritesPage(saved ? [summary()] : [])),
      [REMOVE]: () => {
        saved = false
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()
    renderApp('/favoritos')

    await user.click(await screen.findByRole('button', { name: /^Quitar de favoritos/ }))

    expect(await screen.findByText('Todavía no tienes favoritos')).toBeInTheDocument()
  })

  it('muestra el error si no se pudo quitar', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, favoritesPage([summary()])),
      [REMOVE]: () => jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.')),
    })
    const user = userEvent.setup()
    renderApp('/favoritos')

    await user.click(await screen.findByRole('button', { name: /^Quitar de favoritos/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
  })

  it.each(['SOLD', 'RENTED', 'PAUSED'] as const)(
    'avisa si una propiedad en estado %s ya no está disponible',
    async (status) => {
      routeFetch({
        ...sessionRoutes(currentUser),
        [LIST]: () => jsonResponse(200, favoritesPage([summary({ status })])),
      })

      renderApp('/favoritos')

      const item = await screen.findByRole('listitem')
      expect(within(item).getByText('Ya no está disponible')).toBeInTheDocument()
    },
  )

  it('lee la página de la URL y la manda a la API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, favoritesPage([summary()], { number: 2, totalPages: 3 })),
    })

    renderApp('/favoritos?page=2')

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true)
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
    let attempts = 0
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.'))
          : jsonResponse(200, favoritesPage([]))
      },
    })
    const user = userEvent.setup()
    renderApp('/favoritos')

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('Todavía no tienes favoritos')).toBeVisible())
  })

  it('sin sesión manda a ingresar', async () => {
    routeFetch({})

    renderApp('/favoritos')

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
  })
})
