import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
const EDIT = `/agent/properties/${PROPERTY_ID}`
const PHOTOS = `${EDIT}?paso=fotos`
const PUBLISH = `${EDIT}?paso=publicar`
type User = ReturnType<typeof userEvent.setup>

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Siguiente' }))
const stepHeading = (name: string) => screen.findByRole('heading', { name })
const stepButton = (label: string) =>
  within(screen.getByRole('navigation', { name: 'Pasos' })).getByRole('button', {
    name: new RegExp(`${label}$`),
  })

describe('PropertyCreatePage: wizard', () => {
  async function fillBasics(user: User) {
    await user.type(await screen.findByLabelText('Título'), '  Casa nueva  ')
    await user.selectOptions(screen.getByLabelText('Operación'), 'RENT')
    await user.type(screen.getByLabelText(/^Precio/), '3500.50')
  }

  async function fillUntilDetails(user: User) {
    await fillBasics(user)
    await next(user)
    await user.type(await screen.findByLabelText('Zona'), 'Urubó')
    await next(user)
    await user.type(await screen.findByLabelText('Dormitorios'), '3')
    await user.type(screen.getByLabelText('Baños'), '2')
    await user.type(screen.getByLabelText('Superficie (m²)'), '120')
  }

  it('asks for a few fields per step and creates the draft before the photos', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () => jsonResponse(201, { id: PROPERTY_ID }),
      [`PUT ${PROPERTY_PATH}/features`]: () => jsonResponse(204),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    expect(await stepHeading('¿Qué vas a publicar?')).toBeInTheDocument()
    expect(screen.queryByLabelText('Zona')).not.toBeInTheDocument()
    await fillUntilDetails(user)
    await user.click(screen.getByRole('checkbox', { name: 'Piscina' }))
    await user.click(screen.getByRole('button', { name: 'Crear borrador y seguir' }))

    expect(await stepHeading('Fotos')).toBeInTheDocument()
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
    expect(sentBodies(fetchMock, 'PUT', `${PROPERTY_PATH}/features`)).toEqual([
      { bedrooms: 3, bathrooms: 2, areaM2: 120, features: ['POOL'] },
    ])
  })

  it('going back keeps what was typed', async () => {
    routeFetch(sessionRoutes(agentUser))
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    await fillBasics(user)
    await next(user)
    await user.type(await screen.findByLabelText('Zona'), 'Norte')
    await user.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(await screen.findByLabelText('Título')).toHaveValue('  Casa nueva  ')
    expect(screen.getByLabelText('Operación')).toHaveValue('RENT')
    await next(user)
    expect(await screen.findByLabelText('Zona')).toHaveValue('Norte')
  })

  it('does not move on while a required field is empty', async () => {
    routeFetch(sessionRoutes(agentUser))
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    await screen.findByLabelText('Título')
    await next(user)

    expect(screen.getByLabelText('Título')).toBeInvalid()
    expect(screen.getByRole('heading', { name: '¿Qué vas a publicar?' })).toBeInTheDocument()
  })

  it('previews how the property will look in the catalog while typing', async () => {
    routeFetch(sessionRoutes(agentUser))
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    const preview = await screen.findByRole('complementary', { name: 'Vista previa' })
    expect(within(preview).getByText('Precio a definir')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Título'), 'Casa con patio')
    await user.type(screen.getByLabelText(/^Precio/), '950000')

    expect(within(preview).getByText('Casa con patio')).toBeInTheDocument()
    expect(within(preview).getByText('Bs 950.000')).toBeInTheDocument()
  })

  it('cannot jump to a step it has not reached yet', async () => {
    routeFetch(sessionRoutes(agentUser))
    renderApp('/agent/properties/new?paso=detalles')

    expect(await stepHeading('¿Qué vas a publicar?')).toBeInTheDocument()
    expect(stepButton('Ubicación')).toBeDisabled()
    expect(stepButton('Fotos')).toBeDisabled()
  })

  it('an API error takes the agent back to the step of that field', async () => {
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

    await fillUntilDetails(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador y seguir' }))

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

    await fillUntilDetails(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador y seguir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa Mis propiedades antes de volver a intentarlo',
    )
  })

  it('if the draft was created but the details failed, retrying does not create another', async () => {
    let featuresCalls = 0
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      'POST /api/v1/properties': () => jsonResponse(201, { id: PROPERTY_ID }),
      [`PUT ${PROPERTY_PATH}/features`]: () => {
        featuresCalls += 1
        return featuresCalls === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : jsonResponse(204)
      },
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
    })
    const user = userEvent.setup()
    renderApp('/agent/properties/new')

    await fillUntilDetails(user)
    await user.click(screen.getByRole('button', { name: 'Crear borrador y seguir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Crear borrador y seguir' }))

    expect(await stepHeading('Fotos')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/v1/properties')).toHaveLength(1)
  })
})

describe('PropertyEditPage: wizard', () => {
  const withLocation = () =>
    jsonResponse(
      200,
      detail({
        status: 'DRAFT',
        location: { zone: 'Equipetrol', latitude: -17.76, longitude: -63.19 },
      }),
    )

  it('saves the changes of a step when moving on, without losing data it does not show', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: withLocation,
      [`PUT ${PROPERTY_PATH}`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(EDIT)

    const title = await screen.findByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Título nuevo')
    expect(screen.getByText('Los cambios se guardan al pasar de paso.')).toBeInTheDocument()
    await next(user)

    expect(await stepHeading('¿Dónde está?')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', PROPERTY_PATH)).toEqual([
      {
        title: 'Título nuevo',
        description: 'Casa de dos plantas con jardín y garaje para dos autos.',
        price: { amount: 1285000, currency: 'BOB' },
        location: { zone: 'Equipetrol', latitude: -17.76, longitude: -63.19 },
      },
    ])
  })

  it('does not save anything when moving on without changes', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: withLocation,
    })
    const user = userEvent.setup()
    renderApp(EDIT)

    await screen.findByLabelText('Título')
    await next(user)

    expect(await stepHeading('¿Dónde está?')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('jumping to another step with the step bar also saves the changes', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: withLocation,
      [`PUT ${PROPERTY_PATH}`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(EDIT)

    await user.type(await screen.findByLabelText('Título'), ' renovada')
    await user.click(stepButton('Publicar'))

    expect(await stepHeading('Revisar y publicar')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', PROPERTY_PATH)).toHaveLength(1)
  })

  it('removing the location from the map saves the property without coordinates', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: withLocation,
      [`PUT ${PROPERTY_PATH}`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(`${EDIT}?paso=ubicacion`)

    await user.click(await screen.findByRole('button', { name: 'Quitar ubicación' }))
    expect(screen.getByText('Sin ubicación marcada')).toBeInTheDocument()
    await next(user)

    await stepHeading('¿Cómo es?')
    const [body] = sentBodies(fetchMock, 'PUT', PROPERTY_PATH) as { location: object }[]
    expect(body.location).toEqual({ zone: 'Equipetrol' })
  })

  it('takes typed coordinates and sends them rounded to six decimals', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(200, detail({ status: 'DRAFT', location: { zone: 'Norte' } })),
      [`PUT ${PROPERTY_PATH}`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(`${EDIT}?paso=ubicacion`)

    await user.click(await screen.findByText('Escribir las coordenadas'))
    await user.type(screen.getByLabelText('Latitud'), '-17.73921234')
    await user.type(screen.getByLabelText('Longitud'), '-63.1718')
    await user.click(screen.getByRole('button', { name: 'Usar estas coordenadas' }))
    expect(screen.getByText('-17.73921, -63.17180')).toBeInTheDocument()
    await next(user)

    await stepHeading('¿Cómo es?')
    const [body] = sentBodies(fetchMock, 'PUT', PROPERTY_PATH) as { location: object }[]
    expect(body.location).toEqual({ zone: 'Norte', latitude: -17.739212, longitude: -63.1718 })
  })

  it('rejects coordinates out of range', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })
    const user = userEvent.setup()
    renderApp(`${EDIT}?paso=ubicacion`)

    await user.click(await screen.findByText('Escribir las coordenadas'))
    await user.type(screen.getByLabelText('Latitud'), '95')
    await user.type(screen.getByLabelText('Longitud'), '-63')
    await user.click(screen.getByRole('button', { name: 'Usar estas coordenadas' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/latitud entre -90 y 90/)
  })

  it('does not allow changing the type or the operation', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(EDIT)

    expect(await screen.findByLabelText('Tipo')).toBeDisabled()
    expect(screen.getByLabelText('Operación')).toBeDisabled()
  })

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
    renderApp(`${EDIT}?paso=detalles`)

    await user.type(await screen.findByLabelText('Dormitorios'), '3')
    await user.type(screen.getByLabelText('Baños'), '2')
    await user.type(screen.getByLabelText('Superficie (m²)'), '240.5')
    await user.click(screen.getByRole('checkbox', { name: 'Piscina' }))
    await next(user)

    expect(await stepHeading('Fotos')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', `${PROPERTY_PATH}/features`)).toEqual([
      { bedrooms: 3, bathrooms: 2, areaM2: 240.5, features: ['POOL'] },
    ])
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => init?.method === 'PUT' && String(url).endsWith(PROPERTY_PATH),
      ),
    ).toBe(false)
  })

  it('allows changing the status from the last step', async () => {
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
    renderApp(PUBLISH)

    expect(await stepHeading('Revisar y publicar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Publicar/ }))

    await waitFor(() => expect(screen.getAllByText('Publicada').length).toBeGreaterThan(0))
  })

  it.each(['SOLD', 'RENTED'] as const)(
    'a property in status %s can no longer be edited',
    async (status) => {
      routeFetch({
        ...sessionRoutes(agentUser),
        [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status })),
      })

      renderApp(EDIT)

      expect(await screen.findByText(/ya no se puede editar/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    },
  )

  it('a 404 is shown as property not found', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'No existe.')),
    })

    renderApp(EDIT)

    expect(await screen.findByRole('heading', { name: 'Propiedad no encontrada' })).toBeVisible()
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
    renderApp(PHOTOS)

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
    renderApp(PHOTOS)

    await user.upload(
      await screen.findByLabelText(/^Agregar fotos/),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
    )

    expect(await screen.findByText(/Solo se aceptan fotos JPG o PNG/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir 1 foto' })).toBeDisabled()
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
    renderApp(PHOTOS)

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

    renderApp(PHOTOS)

    expect(await screen.findByText('5 de 5 fotos')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Agregar fotos/)).not.toBeInTheDocument()
  })

  it("shows a draft's photos by asking for them with the agent's token", async () => {
    const images = [{ id: 'img-0', position: 0, url: `${PROPERTY_PATH}/images/img-0` }]
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images })),
      [`GET ${PROPERTY_PATH}/images/img-0`]: () => {
        const response = new Response(null, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        })
        // FileReader usa el Blob de jsdom; Response.blob() en Node devuelve otro tipo de Blob.
        vi.spyOn(response, 'blob').mockResolvedValue(
          new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
        )
        return response
      },
    })

    renderApp(PHOTOS)

    expect(await screen.findByRole('img', { name: 'Foto 1' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png/),
    )
    const imageCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/images/img-0'))
    expect(new Headers(imageCall?.[1]?.headers).get('Authorization')).toBe('Bearer access-nuevo')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('previews the chosen photos before uploading them', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT', images: [] })),
    })
    const user = userEvent.setup()
    renderApp(PHOTOS)

    await user.upload(await screen.findByLabelText(/^Agregar fotos/), [png('a.png'), png('b.png')])

    const pending = screen.getByRole('list', { name: 'Fotos por subir' })
    expect(within(pending).getByText('a.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No subir a.png' }))
    expect(within(pending).queryByText('a.png')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir 1 foto' })).toBeEnabled()
  })

  it('makes a photo the cover by moving it to position 0', async () => {
    const images = [0, 1].map((position) => ({
      id: `img-${position}`,
      position,
      url: `${PROPERTY_PATH}/images/img-${position}`,
    }))
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ images })),
      [`PATCH ${PROPERTY_PATH}/images/img-1`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(PHOTOS)

    await user.click(await screen.findByRole('button', { name: 'Hacer portada' }))

    await waitFor(() =>
      expect(sentBodies(fetchMock, 'PATCH', `${PROPERTY_PATH}/images/img-1`)).toEqual([
        { position: 0 },
      ]),
    )
    expect(screen.getByRole('button', { name: 'Mover la foto 1 antes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mover la foto 2 después' })).toBeDisabled()
  })

  it('removes a photo after confirming', async () => {
    const images = [0, 1].map((position) => ({
      id: `img-${position}`,
      position,
      url: `${PROPERTY_PATH}/images/img-${position}`,
    }))
    const fetchMock = routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ images })),
      [`DELETE ${PROPERTY_PATH}/images/img-1`]: () => jsonResponse(204),
    })
    const user = userEvent.setup()
    renderApp(PHOTOS)

    await user.click(await screen.findByRole('button', { name: 'Quitar la foto 2' }))
    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => init?.method === 'DELETE' && String(url).endsWith('/images/img-1'),
        ),
      ).toBe(true),
    )
  })

  it('does not offer to remove the only photo of a published property', async () => {
    const images = [{ id: 'img-0', position: 0, url: `${PROPERTY_PATH}/images/img-0` }]
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'PUBLISHED', images })),
    })

    renderApp(PHOTOS)

    expect(
      await screen.findByText(/Es la única foto de una propiedad publicada/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar la foto/ })).not.toBeInTheDocument()
  })
})

describe('PropertyEditPage: publishing requirements', () => {
  it('says what is missing and does not allow publishing until it is complete', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () =>
        jsonResponse(200, detail({ status: 'DRAFT', images: [], bedrooms: null })),
    })

    renderApp(PUBLISH)

    expect(await screen.findByText('Agrega al menos una foto.')).toBeInTheDocument()
    expect(screen.getByText('Completa dormitorios, baños y superficie.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Publicar/ })).toBeDisabled()
  })

  it('a complete property can be published', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [`GET ${PROPERTY_PATH}`]: () => jsonResponse(200, detail({ status: 'DRAFT' })),
    })

    renderApp(PUBLISH)

    expect(await screen.findByRole('button', { name: /^Publicar/ })).toBeEnabled()
    expect(screen.queryByText('Para publicar falta:')).not.toBeInTheDocument()
  })
})
