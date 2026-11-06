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
const path = `/propiedades/${PROPERTY_ID}`

describe('favorito en el detalle de una propiedad', () => {
  it('sin sesión invita a ingresar, sin consultar favoritos', async () => {
    const fetchMock = routeFetch({ [DETAIL]: () => jsonResponse(200, detail()) })

    renderApp(path)

    expect(await screen.findByRole('link', { name: 'Ingresa para guardarla' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/favorites'))).toBe(false)
  })

  it('guarda la propiedad y pasa a ofrecer quitarla', async () => {
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

  it('quita una propiedad ya guardada', async () => {
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

  it('no muestra error si ya estaba guardada desde otra pestaña', async () => {
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

  it('no muestra error si ya se había quitado desde otra pestaña', async () => {
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

  it('muestra el error si no se pudo guardar', async () => {
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

  it('una propiedad reservada no se puede guardar', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail({ status: 'RESERVED' })),
      [FAVORITES]: () => jsonResponse(200, favorites(false)),
    })

    renderApp(path)

    await screen.findByText(/Reservada/)
    expect(screen.queryByRole('button', { name: 'Guardar en favoritos' })).not.toBeInTheDocument()
  })

  it('una propiedad reservada que ya estaba guardada se puede quitar', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [DETAIL]: () => jsonResponse(200, detail({ status: 'RESERVED' })),
      [FAVORITES]: () => jsonResponse(200, favorites(true)),
    })

    renderApp(path)

    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument()
  })
})
