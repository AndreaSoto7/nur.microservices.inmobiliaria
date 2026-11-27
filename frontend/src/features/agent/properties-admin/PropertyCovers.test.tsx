import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { agentUser, jsonResponse, problem, routeFetch, sessionRoutes } from '../../../test/http'
import { page, summary } from '../../../test/listingFixtures'
import { renderApp } from '../../../test/renderApp'

describe('Property covers in the agent panel', () => {
  it('shows the cover and keeps editing and every status action available', async () => {
    const property = summary()
    routeFetch({
      ...sessionRoutes(agentUser),
      'GET /api/v1/properties': () => jsonResponse(200, page([property])),
    })
    renderApp('/agent/properties')
    const row = await screen.findByRole('listitem')
    expect(within(row).getByRole('img', { name: `Portada de ${property.title}` })).toHaveAttribute(
      'src',
      expect.stringContaining(property.coverImageUrl!),
    )
    expect(within(row).getByRole('link', { name: `Editar: ${property.title}` })).toHaveAttribute(
      'href',
      `/agent/properties/${property.id}`,
    )
    for (const label of ['Pausar', 'Reservar', 'Marcar vendida']) {
      expect(within(row).getByRole('button', { name: `${label}: ${property.title}` })).toBeEnabled()
    }
  })

  it.each(['DRAFT', 'PAUSED'] as const)(
    'loads a %s cover with the owner token without requesting the property detail',
    async (status) => {
      const property = summary({ status })
      const response = new Response(null, { status: 200, headers: { 'Content-Type': 'image/png' } })
      vi.spyOn(response, 'blob').mockResolvedValue(new Blob(['example'], { type: 'image/png' }))
      const fetchMock = routeFetch({
        ...sessionRoutes(agentUser),
        'GET /api/v1/properties': () => jsonResponse(200, page([property])),
        [`GET ${property.coverImageUrl}`]: () => response,
      })
      renderApp('/agent/properties')
      expect(
        await screen.findByRole('img', { name: `Portada de ${property.title}` }),
      ).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
      const imageCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith(property.coverImageUrl!),
      )
      expect(new Headers(imageCall?.[1]?.headers).get('Authorization')).toBe('Bearer access-nuevo')
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/properties/${property.id}`)),
      ).toBe(false)
    },
  )

  it('keeps the property and actions usable when its private image cannot be recovered', async () => {
    const property = summary({ status: 'PAUSED' })
    routeFetch({
      ...sessionRoutes(agentUser),
      'GET /api/v1/properties': () => jsonResponse(200, page([property])),
      [`GET ${property.coverImageUrl}`]: () =>
        jsonResponse(404, problem(404, 'NOT_FOUND', 'Imagen no disponible.')),
    })
    renderApp('/agent/properties')
    expect(await screen.findByText('Sin foto')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Editar: ${property.title}` })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Volver a publicar: ${property.title}` }),
    ).toBeEnabled()
  })

  it('replaces a broken public image without hiding the property', async () => {
    const property = summary()
    routeFetch({
      ...sessionRoutes(agentUser),
      'GET /api/v1/properties': () => jsonResponse(200, page([property])),
    })
    renderApp('/agent/properties')
    fireEvent.error(await screen.findByRole('img', { name: `Portada de ${property.title}` }))
    expect(screen.getByText('Sin foto')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: property.title })).toBeInTheDocument()
  })
})
