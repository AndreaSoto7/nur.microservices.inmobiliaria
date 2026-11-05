import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockFetch, problem } from '../../test/http'
import { detail, PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

describe('detalle público de una propiedad', () => {
  it('muestra la ficha, el precio y las características', async () => {
    const fetchMock = mockFetch(jsonResponse(200, detail({ operationType: 'RENT' })))

    renderApp(`/propiedades/${PROPERTY_ID}`)

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

  it('ordena la galería por posición y cambia la foto con las miniaturas', async () => {
    mockFetch(jsonResponse(200, detail()))
    const user = userEvent.setup()
    renderApp(`/propiedades/${PROPERTY_ID}`)

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

  it('avisa que está reservada', async () => {
    mockFetch(jsonResponse(200, detail({ status: 'RESERVED' })))

    renderApp(`/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByText(/Reservada: no recibe visitas nuevas/)).toBeInTheDocument()
  })

  it('con 404 explica que ya no está disponible, sin reintentar', async () => {
    const fetchMock = mockFetch(
      jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'La propiedad no existe')),
    )

    renderApp(`/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByText('Esta propiedad no está disponible')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
