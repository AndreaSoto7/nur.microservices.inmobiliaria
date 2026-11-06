import { screen, waitFor, within } from '@testing-library/react'
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
import { visit, VISIT_ID, visitPage } from '../../test/visitFixtures'

const LIST = 'GET /api/v1/visits'
const CANCEL_PATH = `/api/v1/visits/${VISIT_ID}/cancel`
const CATALOG = `GET /api/v1/catalog/properties/${PROPERTY_ID}`
const withProperty = {
  [CATALOG]: () => jsonResponse(200, detail()),
}

describe('MyVisitsPage', () => {
  it('muestra el estado y el título de la propiedad, con enlace a su ficha', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () => jsonResponse(200, visitPage([visit()])),
    })

    renderApp('/mis-visitas')

    const link = await screen.findByRole('link', { name: 'Casa con jardín en Equipetrol' })
    expect(link).toHaveAttribute('href', `/propiedades/${PROPERTY_ID}`)
    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Solicitada')).toBeInTheDocument()
    expect(within(row).getByText('Fecha propuesta')).toBeInTheDocument()
  })

  it('si la propiedad ya no está en el catálogo, lo dice y no enlaza', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [CATALOG]: () => jsonResponse(404, problem(404, 'PROPERTY_NOT_FOUND', 'No existe.')),
      [LIST]: () => jsonResponse(200, visitPage([visit()])),
    })

    renderApp('/mis-visitas')

    const row = await screen.findByRole('listitem')
    expect(await within(row).findByText('Propiedad no disponible')).toBeInTheDocument()
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
  })

  it('muestra el horario de una visita programada', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () =>
        jsonResponse(
          200,
          visitPage([
            visit({
              status: 'SCHEDULED',
              scheduledStart: '2099-01-16T15:00:00Z',
              scheduledEnd: '2099-01-16T16:00:00Z',
            }),
          ]),
        ),
    })

    renderApp('/mis-visitas')

    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('Programada')).toBeInTheDocument()
    expect(within(row).getByText('Horario')).toBeInTheDocument()
  })

  it('muestra el motivo de un rechazo', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () =>
        jsonResponse(
          200,
          visitPage([visit({ status: 'REJECTED', resolutionReason: 'La propiedad se reservó.' })]),
        ),
    })

    renderApp('/mis-visitas')

    expect(await screen.findByText('La propiedad se reservó.')).toBeInTheDocument()
  })

  it.each(['REQUESTED', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const)(
    'una visita en estado %s no se puede cancelar',
    async (status) => {
      routeFetch({
        ...sessionRoutes(currentUser),
        ...withProperty,
        [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      })

      renderApp('/mis-visitas')

      await screen.findByRole('listitem')
      expect(screen.queryByRole('button', { name: /^Cancelar visita/ })).not.toBeInTheDocument()
    },
  )

  it('cancela una visita programada con motivo y actualiza la lista', async () => {
    let status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED'
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () => jsonResponse(200, visitPage([visit({ status })])),
      [`POST ${CANCEL_PATH}`]: () => {
        status = 'CANCELLED'
        return jsonResponse(200, { id: VISIT_ID, status })
      },
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.type(screen.getByLabelText('Motivo (opcional)'), '  Surgió un imprevisto  ')
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() =>
      expect(within(screen.getByRole('listitem')).getByText('Cancelada')).toBeInTheDocument(),
    )
    expect(sentBodies(fetchMock, 'POST', CANCEL_PATH)).toEqual([{ reason: 'Surgió un imprevisto' }])
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/cancel'))
    expect(call?.[1]?.headers).toHaveProperty('Idempotency-Key')
  })

  it('cancelar sin motivo manda un body vacío', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
      [`POST ${CANCEL_PATH}`]: () => jsonResponse(200, { id: VISIT_ID, status: 'CANCELLED' }),
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    await waitFor(() => expect(sentBodies(fetchMock, 'POST', CANCEL_PATH)).toEqual([{}]))
  })

  it('permite arrepentirse sin llamar a la API', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'No, volver' }))

    expect(screen.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/cancel'))).toBe(false)
  })

  it('muestra el motivo si ya es tarde para cancelar', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      ...withProperty,
      [LIST]: () => jsonResponse(200, visitPage([visit({ status: 'SCHEDULED' })])),
      [`POST ${CANCEL_PATH}`]: () =>
        jsonResponse(409, problem(409, 'VISIT_CANCELLATION_TOO_LATE', 'La visita ya empezó.')),
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    await user.click(await screen.findByRole('button', { name: /^Cancelar visita/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La visita ya empezó.')
  })

  it('filtra por estado y lo manda a la API, ordenando por lo más reciente', async () => {
    const fetchMock = routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    await user.selectOptions(await screen.findByLabelText('Estado'), 'SCHEDULED')

    expect(await screen.findByText('No tienes visitas en estado Programada')).toBeInTheDocument()
    const urls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes('/visits'))
    expect(urls.some((url) => url.includes('status=SCHEDULED'))).toBe(true)
    expect(urls.every((url) => url.includes('sort=requestedAt%2Cdesc'))).toBe(true)
  })

  it('explica qué hacer si no tiene visitas', async () => {
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })

    renderApp('/mis-visitas')

    expect(await screen.findByText('Todavía no solicitaste visitas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
  })

  it('muestra el error y permite reintentar si la lista no carga', async () => {
    let attempts = 0
    routeFetch({
      ...sessionRoutes(currentUser),
      [LIST]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(503, problem(503, 'GATEWAY_SERVICE_UNAVAILABLE', 'No disponible.'))
          : jsonResponse(200, visitPage([]))
      },
    })
    const user = userEvent.setup()
    renderApp('/mis-visitas')

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no solicitaste visitas')).toBeInTheDocument()
  })

  it('el enlace aparece para un interesado y un agente no puede entrar', async () => {
    routeFetch({
      ...sessionRoutes(agentUser),
      [LIST]: () => jsonResponse(200, visitPage([])),
    })

    renderApp('/mis-visitas')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mis visitas' })).not.toBeInTheDocument()
  })
})
