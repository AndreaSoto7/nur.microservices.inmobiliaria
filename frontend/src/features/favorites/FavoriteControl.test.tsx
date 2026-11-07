import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  currentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../test/http'
import { detail, PROPERTY_ID, summary } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

const DETAIL = `GET /api/v1/catalog/properties/${PROPERTY_ID}`
const FAVORITES = 'GET /api/v1/favorites'
const ADD = 'POST /api/v1/favorites'
const REMOVE = `DELETE /api/v1/favorites/${PROPERTY_ID}`
const favorites = (saved: boolean) => ({
  data: saved ? [{ property: summary(), savedAt: '2026-10-16T14:30:00Z' }] : [],
  page: { number: 1, size: 100, totalElements: saved ? 1 : 0, totalPages: 1 },
})
const path = `/properties/${PROPERTY_ID}`

describe('favorite on a property detail', () => {
  it('without a session invites to sign in, without fetching favorites', async () => {
    const fetchMock = routeFetch({ [DETAIL]: () => jsonResponse(200, detail()) })

    renderApp(path)

    expect(await screen.findByRole('link', { name: /^Ingresa para guardarla/ })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/favorites'))).toBe(false)
  })

  it('saves the property and switches to offering its removal', async () => {
    let saved = false
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: () => jsonResponse(200, favorites(saved)),
      [ADD]: () => {
        saved = true
        return new Response(null, { status: 201 })
      },
    })
    const user = userEvent.setup()
    renderApp(path)

    await user.click(await screen.findByRole('button', { name: 'Guardar en favoritos' }))

    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/v1/favorites')).toEqual([
      { propertyId: PROPERTY_ID },
    ])
  })

  it('removes an already saved property', async () => {
    let saved = true
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: () => jsonResponse(200, favorites(saved)),
      [REMOVE]: () => {
        saved = false
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()
    renderApp(path)

    await user.click(await screen.findByRole('button', { name: 'Quitar de favoritos' }))

    expect(await screen.findByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument()
  })

  it('shows no error when it was already saved from another tab', async () => {
    let saved = false
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: () => jsonResponse(200, favorites(saved)),
      [ADD]: () => {
        saved = true
        return jsonResponse(409, problem(409, 'FAVORITE_ALREADY_EXISTS', 'Ya está guardada.'))
      },
    })
    const user = userEvent.setup()
    renderApp(path)

    await user.click(await screen.findByRole('button', { name: 'Guardar en favoritos' }))

    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no error when it was already removed from another tab', async () => {
    let saved = true
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: () => jsonResponse(200, favorites(saved)),
      [REMOVE]: () => {
        saved = false
        return jsonResponse(404, problem(404, 'FAVORITE_NOT_FOUND', 'No está guardada.'))
      },
    })
    const user = userEvent.setup()
    renderApp(path)

    await user.click(await screen.findByRole('button', { name: 'Quitar de favoritos' }))

    expect(await screen.findByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error when it could not be saved', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: () => jsonResponse(200, favorites(false)),
      [ADD]: () =>
        jsonResponse(409, problem(409, 'FAVORITE_PROPERTY_NOT_PUBLISHED', 'Ya no está publicada.')),
    })
    const user = userEvent.setup()
    renderApp(path)

    await user.click(await screen.findByRole('button', { name: 'Guardar en favoritos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no está publicada.')
  })

  it('a reserved property cannot be saved', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail({ status: 'RESERVED' })),
      [FAVORITES]: () => jsonResponse(200, favorites(false)),
    })

    renderApp(path)

    await screen.findByText(/Reservada/)
    expect(screen.queryByRole('button', { name: 'Guardar en favoritos' })).not.toBeInTheDocument()
  })

  it('a reserved property that was already saved can be removed', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail({ status: 'RESERVED' })),
      [FAVORITES]: () => jsonResponse(200, favorites(true)),
    })

    renderApp(path)

    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument()
  })
})
