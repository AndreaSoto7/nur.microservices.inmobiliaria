import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockFetch, problem } from '../../test/http'
import { detail, PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

describe('public property detail', () => {
  it('shows the listing, the price and the features', async () => {
    const fetchMock = mockFetch(jsonResponse(200, detail({ operationType: 'RENT' })))

    renderApp(`/properties/${PROPERTY_ID}`)

    expect(
      await screen.findByRole('heading', { name: 'Casa con jardín en Equipetrol' }),
    ).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `http://localhost:8080/api/v1/catalog/properties/${PROPERTY_ID}`,
    )
    expect(screen.getByText('Bs 1.285.000 / mes')).toBeInTheDocument()
    expect(screen.getByText('Alquiler')).toBeInTheDocument()
    expect(screen.getByText('240.5 m²')).toBeInTheDocument()
    expect(screen.getByText('Garaje')).toBeInTheDocument()
    expect(screen.getByText(/Casa de dos plantas/)).toBeInTheDocument()
  })

  it('puts the price next to the title and the description in the side card, before signing in', async () => {
    mockFetch(jsonResponse(200, detail()))

    renderApp(`/properties/${PROPERTY_ID}`)

    const title = await screen.findByRole('heading', { level: 1 })
    expect(within(title.closest('header') as HTMLElement).getByText('Bs 1.285.000')).toBeVisible()
    const card = screen.getByRole('complementary', { name: 'Sobre la propiedad' })
    const description = within(card).getByText(/Casa de dos plantas/)
    const signIn = within(card).getByRole('link', { name: /Ingresa para guardarla/ })
    expect(
      description.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('goes through the photos with the arrows, wrapping around', async () => {
    mockFetch(jsonResponse(200, detail()))
    const user = userEvent.setup()
    renderApp(`/properties/${PROPERTY_ID}`)

    await user.click(await screen.findByRole('button', { name: 'Foto siguiente' }))
    expect(screen.getByRole('img', { name: /foto 2 de 2/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Foto siguiente' }))
    expect(screen.getByRole('img', { name: /foto 1 de 2/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Foto anterior' }))
    expect(screen.getByRole('img', { name: /foto 2 de 2/ })).toBeInTheDocument()
  })

  it('cuts a long description and opens it with Leer más', async () => {
    mockFetch(jsonResponse(200, detail({ description: 'Amplia. '.repeat(80) })))
    const user = userEvent.setup()
    renderApp(`/properties/${PROPERTY_ID}`)

    await user.click(await screen.findByRole('button', { name: 'Leer más' }))

    expect(screen.getByRole('button', { name: 'Leer menos' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('sorts the gallery by position and switches the photo with the thumbnails', async () => {
    mockFetch(jsonResponse(200, detail()))
    const user = userEvent.setup()
    renderApp(`/properties/${PROPERTY_ID}`)

    const main = await screen.findByRole('img', { name: /foto 1 de 2/ })
    expect(main).toHaveAttribute('src', expect.stringContaining('/images/img-1'))

    await user.click(screen.getByRole('button', { name: 'Ver foto 2' }))

    expect(screen.getByRole('img', { name: /foto 2 de 2/ })).toHaveAttribute(
      'src',
      expect.stringContaining('/images/img-2'),
    )
    expect(screen.getByRole('button', { name: 'Ver foto 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('warns that it is reserved', async () => {
    mockFetch(jsonResponse(200, detail({ status: 'RESERVED' })))

    renderApp(`/properties/${PROPERTY_ID}`)

    expect(await screen.findByText(/Reservada: no recibe visitas nuevas/)).toBeInTheDocument()
  })

  it('on 404 explains that it is no longer available, without retrying', async () => {
    const fetchMock = mockFetch(
      jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'La propiedad no existe')),
    )

    renderApp(`/properties/${PROPERTY_ID}`)

    expect(await screen.findByText('Esta propiedad no está disponible')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
