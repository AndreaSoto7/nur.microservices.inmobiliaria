import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  agentUser,
  currentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../test/http'
import { detail, PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

const DETAIL = `GET /api/v1/catalog/properties/${PROPERTY_ID}`
const FAVORITES = 'GET /api/v1/favorites'
const NO_FAVORITES = () =>
  jsonResponse(200, {
    data: [],
    page: { number: 1, size: 100, totalElements: 0, totalPages: 0 },
  })
const path = `/propiedades/${PROPERTY_ID}`
const routes = (status: 'PUBLISHED' | 'RESERVED' = 'PUBLISHED') => ({
  ...sessionRoutes(currentUser),
  [DETAIL]: () => jsonResponse(200, detail({ status })),
  [FAVORITES]: NO_FAVORITES,
})
const keysSentTo = (fetchMock: ReturnType<typeof routeFetch>, path: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).endsWith(path))
    .map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key'])

async function openVisitForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('Solicitar una visita'))
}

async function openInquiryForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('Enviar una consulta'))
}

describe('solicitar una visita desde el detalle', () => {
  it('manda la fecha en UTC, sin nota vacía y con Idempotency-Key', async () => {
    const fetchMock = routeFetch({
      ...routes(),
      'POST /api/v1/visits': () => jsonResponse(201, { id: 'visita-1' }),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openVisitForm(user)
    await user.type(screen.getByLabelText('Fecha y hora'), '2099-01-15T10:30')
    await user.click(screen.getByRole('button', { name: 'Solicitar visita' }))

    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/v1/visits')).toEqual([
      { propertyId: PROPERTY_ID, proposedAt: new Date('2099-01-15T10:30').toISOString() },
    ])
    expect(keysSentTo(fetchMock, '/api/v1/visits')[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('incluye la nota si se escribió', async () => {
    const fetchMock = routeFetch({
      ...routes(),
      'POST /api/v1/visits': () => jsonResponse(201, { id: 'visita-1' }),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openVisitForm(user)
    await user.type(screen.getByLabelText('Fecha y hora'), '2099-01-15T10:30')
    await user.type(screen.getByLabelText('Nota para el agente (opcional)'), 'Voy con mi familia')
    await user.click(screen.getByRole('button', { name: 'Solicitar visita' }))

    await screen.findByText(/Solicitud enviada/)
    expect(sentBodies(fetchMock, 'POST', '/api/v1/visits')[0]).toMatchObject({
      clientNote: 'Voy con mi familia',
    })
  })

  it('reintentar tras un fallo reutiliza la clave, para no duplicar la solicitud', async () => {
    let attempts = 0
    const fetchMock = routeFetch({
      ...routes(),
      'POST /api/v1/visits': () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Falló el servidor.'))
          : jsonResponse(201, { id: 'visita-1' })
      },
    })
    const user = userEvent.setup()
    renderApp(path)

    await openVisitForm(user)
    await user.type(screen.getByLabelText('Fecha y hora'), '2099-01-15T10:30')
    await user.click(screen.getByRole('button', { name: 'Solicitar visita' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor.')
    await user.click(screen.getByRole('button', { name: 'Solicitar visita' }))

    await screen.findByText(/Solicitud enviada/)
    const [first, second] = keysSentTo(fetchMock, '/api/v1/visits')
    expect(first).toBe(second)
  })

  it('muestra el motivo si ya hay una solicitud activa', async () => {
    routeFetch({
      ...routes(),
      'POST /api/v1/visits': () =>
        jsonResponse(
          409,
          problem(409, 'VISIT_ALREADY_REQUESTED', 'Ya tienes una solicitud activa.'),
        ),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openVisitForm(user)
    await user.type(screen.getByLabelText('Fecha y hora'), '2099-01-15T10:30')
    await user.click(screen.getByRole('button', { name: 'Solicitar visita' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes una solicitud activa.')
  })
})

describe('enviar una consulta desde el detalle', () => {
  it('propone los datos de la cuenta y omite el teléfono vacío', async () => {
    const fetchMock = routeFetch({
      ...routes(),
      'POST /api/v1/inquiries': () => jsonResponse(201, { id: 'consulta-1' }),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openInquiryForm(user)
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Pérez')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    await user.type(screen.getByLabelText('Mensaje'), '  ¿Aceptan mascotas?  ')
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }))

    expect(await screen.findByText(/Consulta enviada/)).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/v1/inquiries')).toEqual([
      {
        propertyId: PROPERTY_ID,
        contactName: 'Ana Pérez',
        contactEmail: 'ana@example.com',
        message: '¿Aceptan mascotas?',
      },
    ])
    expect(keysSentTo(fetchMock, '/api/v1/inquiries')[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('incluye el teléfono si se escribió', async () => {
    const fetchMock = routeFetch({
      ...routes(),
      'POST /api/v1/inquiries': () => jsonResponse(201, { id: 'consulta-1' }),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openInquiryForm(user)
    await user.type(screen.getByLabelText('Teléfono (opcional)'), '70000000')
    await user.type(screen.getByLabelText('Mensaje'), 'Hola')
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }))

    await screen.findByText(/Consulta enviada/)
    expect(sentBodies(fetchMock, 'POST', '/api/v1/inquiries')[0]).toMatchObject({
      contactPhone: '70000000',
    })
  })

  it('muestra junto al campo los errores de validación', async () => {
    routeFetch({
      ...routes(),
      'POST /api/v1/inquiries': () =>
        jsonResponse(400, {
          ...problem(400, 'VALIDATION_ERROR', 'Hay datos inválidos.'),
          errors: [{ field: 'contactEmail', message: 'El email no es válido.' }],
        }),
    })
    const user = userEvent.setup()
    renderApp(path)

    await openInquiryForm(user)
    await user.type(screen.getByLabelText('Mensaje'), 'Hola')
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }))

    expect(await screen.findByText('El email no es válido.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('quién puede contactar', () => {
  it('sin sesión invita a ingresar y vuelve a la misma ficha', async () => {
    routeFetch({ [DETAIL]: () => jsonResponse(200, detail()) })

    renderApp(path)

    expect(
      await screen.findByRole('link', {
        name: 'Ingresa para guardarla, consultar o pedir una visita',
      }),
    ).toHaveAttribute('href', '/login')
    expect(screen.queryByText('Solicitar una visita')).not.toBeInTheDocument()
  })

  it('un agente no solicita visitas', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [DETAIL]: () => jsonResponse(200, detail()),
      [FAVORITES]: NO_FAVORITES,
    })

    renderApp(path)

    await screen.findByRole('button', { name: 'Guardar en favoritos' })
    expect(screen.queryByText('Solicitar una visita')).not.toBeInTheDocument()
    expect(screen.queryByText('Enviar una consulta')).not.toBeInTheDocument()
  })

  it('una propiedad reservada no recibe solicitudes ni consultas', async () => {
    routeFetch(routes('RESERVED'))

    renderApp(path)

    await screen.findByText(/Reservada: no recibe visitas nuevas/)
    expect(screen.queryByText('Solicitar una visita')).not.toBeInTheDocument()
    expect(screen.queryByText('Enviar una consulta')).not.toBeInTheDocument()
  })

  it('sin sesión tampoco invita a ingresar si la propiedad está reservada', async () => {
    routeFetch({ [DETAIL]: () => jsonResponse(200, detail({ status: 'RESERVED' })) })

    renderApp(path)

    await screen.findByText(/Reservada: no recibe visitas nuevas/)
    expect(screen.queryByRole('link', { name: /^Ingresa para/ })).not.toBeInTheDocument()
  })
})
