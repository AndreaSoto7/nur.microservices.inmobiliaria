import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { currentUser, jsonResponse, routeFetch, sessionRoutes } from '../../test/http'
import { detail, PROPERTY_ID } from '../../test/listingFixtures'
import { renderApp } from '../../test/renderApp'

const INQUIRY_ID = '05de258b-be6c-4f61-b6ac-ac67cc961b03'
const summary = {
  id: INQUIRY_ID,
  propertyId: PROPERTY_ID,
  contactName: 'Diego Interesado',
  createdAt: '2026-10-16T14:30:00Z',
}
const base = () => ({
  ...sessionRoutes(currentUser),
  [`GET /api/v1/catalog/properties/${PROPERTY_ID}`]: () =>
    jsonResponse(200, detail({ title: 'Casa con jardín' })),
})
const listOf = (items: object[]) => () =>
  jsonResponse(200, {
    data: items,
    page: { number: 1, size: 20, totalElements: items.length, totalPages: 1 },
  })

describe('MyInquiriesPage', () => {
  it('shows the agent reply when opening an answered inquiry', async () => {
    routeFetch({
      ...base(),
      'GET /api/v1/inquiries': listOf([{ ...summary, repliedAt: '2026-10-17T10:00:00Z' }]),
      [`GET /api/v1/inquiries/${INQUIRY_ID}`]: () =>
        jsonResponse(200, {
          ...summary,
          contactEmail: 'cliente@demo.test',
          message: '¿Aceptan mascotas?',
          reply: 'Sí, mascotas pequeñas.',
          repliedAt: '2026-10-17T10:00:00Z',
        }),
    })
    const user = userEvent.setup()
    renderApp('/my-inquiries')

    const row = await screen.findByRole('listitem')
    expect(await within(row).findByRole('link', { name: 'Casa con jardín' })).toHaveAttribute(
      'href',
      `/properties/${PROPERTY_ID}`,
    )
    expect(within(row).getByText('Respondida')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: /^Ver consulta/ }))

    expect(await screen.findByText('¿Aceptan mascotas?')).toBeInTheDocument()
    expect(screen.getByText('Sí, mascotas pequeñas.')).toBeInTheDocument()
  })

  it('says it is still waiting when the agent has not replied', async () => {
    routeFetch({
      ...base(),
      'GET /api/v1/inquiries': listOf([summary]),
      [`GET /api/v1/inquiries/${INQUIRY_ID}`]: () =>
        jsonResponse(200, { ...summary, contactEmail: 'c@demo.test', message: '¿Precio final?' }),
    })
    const user = userEvent.setup()
    renderApp('/my-inquiries')

    expect(await screen.findByText('Esperando respuesta')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Ver consulta/ }))
    expect(await screen.findByText(/todavía no respondió/)).toBeInTheDocument()
  })

  it('explains how to ask when there are no inquiries yet', async () => {
    routeFetch({ ...base(), 'GET /api/v1/inquiries': listOf([]) })

    renderApp('/my-inquiries')

    expect(await screen.findByText('Todavía no enviaste consultas')).toBeInTheDocument()
  })
})
