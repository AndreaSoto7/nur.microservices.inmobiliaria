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

  it('creates the draft with the contract format and opens its edit page', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () => jsonResponse(201, { id: PROPERTY_ID }),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

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

  it('shows the API validation errors next to each field', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () =>
        jsonResponse(400, {
          ...problem(400, 'VALIDATION_ERROR', 'Hay datos inválidos.'),
          errors: [{ field: 'price.amount', message: 'Debe ser mayor a 0.' }],
        }),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByText('Debe ser mayor a 0.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Precio/)).toHaveAttribute('aria-invalid', 'true')
  })
  it('warns that it may have been created when the server did not respond in time', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () =>
        jsonResponse(504, problem(504, 'GATEWAY_UPSTREAM_TIMEOUT', 'El servicio tardó demasiado.')),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa Mis propiedades antes de volver a intentarlo',
    )
  })
})

describe('PropertyEditPage', () => {
  it('saves the changes without losing data the form does not show', async () => {
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
    renderApp(`/agent/properties/${PROPERTY_ID}`)

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

  it('does not allow changing the type or the operation', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByLabelText('Tipo')).toBeDisabled()
    expect(screen.getByLabelText('Operación')).toBeDisabled()
  })

  it('allows changing the status from the edit page', async () => {
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
    renderApp(`/agent/properties/${PROPERTY_ID}`)

    await user.click(await screen.findByRole('button', { name: /^Publicar/ }))

    await waitFor(() => expect(screen.getByText('Publicada')).toBeInTheDocument())
  })

  it.each(['SOLD', 'RENTED'] as const)(
    'a property in status %s can no longer be edited',
    async (status) => {
      routeFetch({
        ...sessionRoutes(agentUser),
        [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status })),
      })

      renderApp(`/agent/properties/${PROPERTY_ID}`)

      expect(await screen.findByText(/ya no se puede editar/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    },
  )

  it('a 404 is shown as property not found', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'No existe.')),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByRole('heading', { name: 'Propiedad no encontrada' })).toBeVisible()
  })
})

describe('PropertyEditPage: features', () => {
  it('saves bedrooms, bathrooms, area and extras with the contract format', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(
          200,
          detail({ status: 'DRAFT', bedrooms: null, bathrooms: null, areaM2: null, features: [] }),
        ),
      [`PUT ${PROPERTY_PATH}/features`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(`/agent/properties/${PROPERTY_ID}`)

    await user.type(await screen.findByLabelText('Dormitorios'), '3')
    await user.type(screen.getByLabelText('Baños'), '2')
    await user.type(screen.getByLabelText('Superficie (m²)'), '240.5')
    await user.click(screen.getByRole('checkbox', { name: 'Piscina' }))
    await user.click(screen.getByRole('button', { name: 'Guardar características' }))

    expect(await screen.findByText('Características guardadas.')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', `${PROPERTY_PATH}/features`)).toEqual([
      { bedrooms: 3, bathrooms: 2, areaM2: 240.5, features: ['POOL'] },
    ])
  })
})

describe('PropertyEditPage: photos', () => {
  const png = (name: string) => new File(['x'], name, { type: 'image/png' })

  it('uploads the chosen photos as multipart, in the files field', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
      [`POST ${PROPERTY_PATH}/images`]: () => jsonResponse(201, { imageIds: ['a'] }),
    })
    const user = userEvent.setup()
    renderApp(`/agent/properties/${PROPERTY_ID}`)

    await user.upload(await screen.findByLabelText(/^Agregar fotos/), [png('a.png'), png('b.png')])
    await user.click(screen.getByRole('button', { name: 'Subir 2 fotos' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/images'))
      const files = (call?.[1]?.body as FormData).getAll('files') as File[]
      expect(files.map((file) => file.name)).toEqual(['a.png', 'b.png'])
    })
  })

  it('rejects a disallowed format without calling the API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
    })
    const user = userEvent.setup({ applyAccept: false })
    renderApp(`/agent/properties/${PROPERTY_ID}`)

    await user.upload(
      await screen.findByLabelText(/^Agregar fotos/),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
    )

    expect(await screen.findByText(/Solo se aceptan fotos JPG o PNG/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Subir/ })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/images'))).toBe(false)
  })

  it('shows the API error when the upload fails', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
      [`POST ${PROPERTY_PATH}/images`]: () =>
        jsonResponse(409, problem(409, 'PROPERTY_IMAGE_LIMIT', 'Ya tiene el máximo de fotos.')),
    })
    const user = userEvent.setup()
    renderApp(`/agent/properties/${PROPERTY_ID}`)

    await user.upload(await screen.findByLabelText(/^Agregar fotos/), png('a.png'))
    await user.click(screen.getByRole('button', { name: 'Subir 1 foto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tiene el máximo de fotos.')
  })

  it('does not offer to upload more when it already has the maximum', async () => {
    const images = [0, 1, 2, 3, 4].map((position) => ({
      id: `img-${position}`,
      position,
      url: `/api/v1/properties/${PROPERTY_ID}/images/img-${position}`,
    }))
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ images })),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByText('5 de 5 fotos')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Agregar fotos/)).not.toBeInTheDocument()
  })

  it("warns that a draft's photos cannot be previewed", async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByText(/se ven cuando la propiedad está publicada/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('PropertyEditPage: publishing requirements', () => {
  it('says what is missing and does not allow publishing until it is complete', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(200, detail({ status: 'DRAFT', images: [], bedrooms: null })),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByText('Agrega al menos una foto.')).toBeInTheDocument()
    expect(screen.getByText('Completa dormitorios, baños y superficie.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Publicar/ })).toBeDisabled()
  })

  it('a complete property can be published', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agent/properties/${PROPERTY_ID}`)

    expect(await screen.findByRole('button', { name: /^Publicar/ })).toBeEnabled()
    expect(screen.queryByText('Para publicar falta:')).not.toBeInTheDocument()
  })
})
