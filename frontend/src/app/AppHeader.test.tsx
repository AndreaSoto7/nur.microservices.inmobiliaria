import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '../core/models/identity'
import { agentUser, currentUser, jsonResponse, routeFetch, sessionRoutes } from '../test/http'
import { renderApp } from '../test/renderApp'

const MENU = 'Menú de Ana Pérez'
const CATALOG = {
  'GET /api/v1/catalog/properties': () =>
    jsonResponse(200, { data: [], page: { number: 1, size: 12, totalElements: 0, totalPages: 0 } }),
}
const NOTIFICATIONS = {
  'GET /api/v1/notifications': () =>
    jsonResponse(200, { data: [], page: { number: 1, size: 1, totalElements: 2, totalPages: 2 } }),
}
const signedIn = (user: CurrentUser = currentUser) =>
  routeFetch({
    ...sessionRoutes(user),
    ...CATALOG,
    ...NOTIFICATIONS,
    'POST /api/v1/auth/logout': () => jsonResponse(204),
  })
const openMenu = async (name = MENU) => {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name }))
  return user
}

describe('app header', () => {
  it('offers a link back to the start', async () => {
    signedIn()

    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/')
  })

  it('shows notifications as a bell with the unread count', async () => {
    signedIn()

    renderApp('/')

    const bell = await screen.findByRole('link', { name: 'Avisos, 2 sin leer' })
    expect(bell).toHaveAttribute('href', '/notifications')
    expect(bell.querySelector('svg')).not.toBeNull()
  })

  it('keeps favorites, account and logout closed until the menu is opened', async () => {
    signedIn()

    renderApp('/')

    const trigger = await screen.findByRole('button', { name: MENU })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Favoritos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()

    await userEvent.setup().click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute('href', '/favorites')
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('no longer greets the user with a separate text', async () => {
    signedIn()

    renderApp('/')

    await screen.findByRole('button', { name: MENU })
    expect(screen.queryByText(/^Hola,/)).not.toBeInTheDocument()
  })

  it('closes the menu after choosing an option', async () => {
    signedIn()
    renderApp('/')

    const user = await openMenu()
    await user.click(screen.getByRole('link', { name: 'Mi cuenta' }))

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('closes with Escape and returns the focus to the button', async () => {
    signedIn()
    renderApp('/')

    const user = await openMenu()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: MENU })).toHaveFocus()
  })

  it('closes when clicking outside', async () => {
    signedIn()
    renderApp('/')

    const user = await openMenu()
    await user.click(screen.getByRole('main'))

    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument()
  })

  it('logs out from the menu', async () => {
    const fetchMock = signedIn()
    renderApp('/')

    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('link', { name: 'Ingresar' })).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(true),
    )
  })

  it('does not offer favorites to an administrator', async () => {
    signedIn({ ...currentUser, roles: ['ADMIN'] })
    renderApp('/')

    await openMenu()

    expect(screen.queryByRole('link', { name: 'Favoritos' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument()
  })

  it('keeps the main section of each role visible in the header', async () => {
    signedIn(agentUser)

    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Panel de agente' })).toBeInTheDocument()
  })

  it('shows sign in and register without a session', async () => {
    routeFetch(CATALOG)

    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Menú de/ })).not.toBeInTheDocument()
  })
})
