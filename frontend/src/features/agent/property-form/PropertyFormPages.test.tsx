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
  it('avisa que puede haberse creado si el servidor no respondió a tiempo', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () =>
        jsonResponse(504, problem(504, 'GATEWAY_UPSTREAM_TIMEOUT', 'El servicio tardó demasiado.')),
    })
    const user = userEvent.setup()
    renderApp('/agente/propiedades/nueva')

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa Mis propiedades antes de volver a intentarlo',
    )
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

describe('PropertyEditPage: características', () => {
  it('guarda dormitorios, baños, superficie y extras con el formato del contrato', async () => {
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
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

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

describe('PropertyEditPage: fotos', () => {
  const png = (name: string) => new File(['x'], name, { type: 'image/png' })

  it('sube las fotos elegidas como multipart, en el campo files', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
      [`POST ${PROPERTY_PATH}/images`]: () => jsonResponse(201, { imageIds: ['a'] }),
    })
    const user = userEvent.setup()
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    await user.upload(await screen.findByLabelText(/^Agregar fotos/), [png('a.png'), png('b.png')])
    await user.click(screen.getByRole('button', { name: 'Subir 2 fotos' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/images'))
      const files = (call?.[1]?.body as FormData).getAll('files') as File[]
      expect(files.map((file) => file.name)).toEqual(['a.png', 'b.png'])
    })
  })

  it('rechaza un formato no permitido sin llamar a la API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
    })
    const user = userEvent.setup({ applyAccept: false })
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    await user.upload(
      await screen.findByLabelText(/^Agregar fotos/),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
    )

    expect(await screen.findByText(/Solo se aceptan fotos JPG o PNG/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Subir/ })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/images'))).toBe(false)
  })

  it('muestra el error de la API si la subida falla', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
      [`POST ${PROPERTY_PATH}/images`]: () =>
        jsonResponse(409, problem(409, 'PROPERTY_IMAGE_LIMIT', 'Ya tiene el máximo de fotos.')),
    })
    const user = userEvent.setup()
    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    await user.upload(await screen.findByLabelText(/^Agregar fotos/), png('a.png'))
    await user.click(screen.getByRole('button', { name: 'Subir 1 foto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tiene el máximo de fotos.')
  })

  it('no ofrece subir más si ya tiene el máximo', async () => {
    const images = [0, 1, 2, 3, 4].map((position) => ({
      id: `img-${position}`,
      position,
      url: `/api/v1/properties/${PROPERTY_ID}/images/img-${position}`,
    }))
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ images })),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByText('5 de 5 fotos')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Agregar fotos/)).not.toBeInTheDocument()
  })

  it('avisa que las fotos de un borrador no se pueden previsualizar', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByText(/se ven cuando la propiedad está publicada/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('PropertyEditPage: requisitos para publicar', () => {
  it('dice qué falta y no deja publicar hasta completarlo', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(200, detail({ status: 'DRAFT', images: [], bedrooms: null })),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByText('Agrega al menos una foto.')).toBeInTheDocument()
    expect(screen.getByText('Completa dormitorios, baños y superficie.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Publicar/ })).toBeDisabled()
  })

  it('una propiedad completa se puede publicar', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(`/agente/propiedades/${PROPERTY_ID}`)

    expect(await screen.findByRole('button', { name: /^Publicar/ })).toBeEnabled()
    expect(screen.queryByText('Para publicar falta:')).not.toBeInTheDocument()
  })
})
