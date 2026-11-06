import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  agentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../../test/http'
import { detail, PROPERTY_ID } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'

const PROPERTY_PATH = `/api/v1/properties/${PROPERTY_ID}`

describe('PropertyCreatePage', () => {
  async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('Título'), '  Casa nueva  ')
    await user.selectOptions(screen.getByLabelText('Operación'), 'RENT')
    await user.type(screen.getByLabelText(/^Precio/), '3500.50')
    await user.type(screen.getByLabelText('Zona'), 'Urubó')
  }

  it('crea el borrador con el formato del contrato y abre su edición', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () => jsonResponse(201, { id: PROPERTY_ID }),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })
    const user = userEvent.setup()
    renderApp('/agente/propiedades/nueva')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByRole('heading', { name: 'Editar propiedad' })).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/v1/properties')).toEqual([
      {
        title: 'Casa nueva',
        description: '',
        propertyType: 'HOUSE',
        operationType: 'RENT',
        price: { amount: 3500.5, currency: 'BOB' },
        location: { zone: 'Urubó' },
      },
    ])
  })

  it('muestra junto a cada campo los errores de validación de la API', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () =>
        jsonResponse(400, {
          ...problem(400, 'VALIDATION_ERROR', 'Hay datos inválidos.'),
          errors: [{ field: 'price.amount', message: 'Debe ser mayor a 0.' }],
        }),
    })
    const user = userEvent.setup()
    renderApp('/agente/propiedades/nueva')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByText('Debe ser mayor a 0.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Precio/)).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('PropertyEditPage', () => {
  it('guarda los cambios sin perder datos que el formulario no muestra', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(
          200,
          detail({
            status: 'DRAFT',
            location: { zone: 'Equipetrol', latitude: -17.76, longitude: -63.19 },
          }),
        ),
      [`PUT ${PROPERTY_PATH}`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    const title = await screen.findByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Título nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', PROPERTY_PATH)).toEqual([
      {
        title: 'Título nuevo',
        description: 'Casa de dos plantas con jardín y garaje para dos autos.',
        price: { amount: 1285000, currency: 'BOB' },
        location: { zone: 'Equipetrol', latitude: -17.76, longitude: -63.19 },
      },
    ])
  })

  it('no deja cambiar el tipo ni la operación', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByLabelText('Tipo')).toBeDisabled()
    expect(screen.getByLabelText('Operación')).toBeDisabled()
  })

  it('permite cambiar el estado desde la edición', async () => {
    let status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status })),
      [`POST ${PROPERTY_PATH}/publish`]: () => {
        status = 'PUBLISHED'
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    await waitFor(() => expect(screen.getByText('Publicada')).toBeInTheDocument())
  })

  it.each(['SOLD', 'RENTED'] as const)(
    'una propiedad en estado %s ya no se edita',
    async (status) => {
      routeFetch({
        ...sessionRoutes(agentUser),
        [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status })),
      })

      renderApp(`/agente/propiedades/${PROPERTY_ID}`)

      expect(await screen.findByText(/ya no se puede editar/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    },
  )

  it('un 404 se muestra como propiedad no encontrada', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'No existe.')),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByRole('heading', { name: 'Propiedad no encontrada' })).toBeVisible()
  })
})
