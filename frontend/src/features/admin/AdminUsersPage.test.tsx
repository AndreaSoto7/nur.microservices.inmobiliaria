import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AdminUser } from '../../core/models/identity'
import {
  agentUser,
  currentUser,
  jsonResponse,
  problem,
  routeFetch,
  sentBodies,
  sessionRoutes,
} from '../../test/http'
import { renderApp } from '../../test/renderApp'

const LIST = 'GET /api/v1/users'
const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const ANA_ID = '22222222-2222-4222-8222-222222222222'
const adminSession = {
  ...currentUser,
  id: ADMIN_ID,
  fullName: 'Admin Demo',
  roles: ['ADMIN' as const],
}

const ana = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: ANA_ID,
  email: 'ana@example.com',
  fullName: 'Ana Pérez',
  roles: ['CLIENT'],
  active: true,
  registeredAt: '2026-10-16T14:30:00Z',
  ...overrides,
})
const self = (): AdminUser => ({
  id: ADMIN_ID,
  email: 'admin@example.com',
  fullName: 'Admin Demo',
  roles: ['ADMIN'],
  active: true,
  registeredAt: '2026-10-16T14:30:00Z',
})
const pageOf = (...users: AdminUser[]) => ({
  data: users,
  page: { number: 1, size: 20, totalElements: users.length, totalPages: 1 },
})
const rowOf = (name: string) =>
  screen.getByRole('heading', { name: new RegExp(name) }).closest('li') as HTMLElement

const base = () => sessionRoutes(adminSession)

describe('AdminUsersPage', () => {
  it('lists each account with its email, roles and status', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf(ana())) })

    renderApp('/admin/users')

    const name = await screen.findByRole('heading', { name: 'Ana Pérez' })
    const row = within(name.closest('li') as HTMLElement)
    expect(row.getByText('ana@example.com')).toBeInTheDocument()
    expect(row.getByText('Interesado')).toBeInTheDocument()
    expect(row.getByText('Activa')).toBeInTheDocument()
  })

  it('shows the link in the header only to an administrator', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf(ana())) })

    renderApp('/admin/users')

    expect(await screen.findByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/admin/users',
    )
  })

  it.each([
    ['client', currentUser],
    ['agent', agentUser],
  ])('denies the page to a %s without asking for the list', async (_label, user) => {
    const fetchMock = routeFetch({ ...sessionRoutes(user) })

    renderApp('/admin/users')

    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => /\/api\/v1\/users(\?|$)/.test(url))).toBe(false)
  })

  it('filters by role through the URL', async () => {
    const fetchMock = routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf(ana())) })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await screen.findByRole('heading', { name: 'Ana Pérez' })
    await user.selectOptions(screen.getByLabelText('Rol'), 'AGENT')

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('role=AGENT'))).toBe(true),
    )
  })

  it('saves the new roles and closes the panel', async () => {
    let current = ana()
    const path = `/api/v1/users/${ANA_ID}/roles`
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, pageOf(current)),
      [`PUT ${path}`]: () => {
        current = ana({ roles: ['CLIENT', 'AGENT'] })
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await user.click(await screen.findByRole('button', { name: 'Cambiar roles: Ana Pérez' }))
    await user.click(screen.getByRole('checkbox', { name: 'Agente' }))
    await user.click(screen.getByRole('button', { name: 'Guardar roles' }))

    expect(await within(rowOf('Ana Pérez')).findByText('Interesado, Agente')).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'PUT', path)).toEqual([{ roles: ['CLIENT', 'AGENT'] }])
    expect(screen.queryByRole('button', { name: 'Guardar roles' })).not.toBeInTheDocument()
  })

  it('does not save without changes nor without any role', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf(ana())) })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await user.click(await screen.findByRole('button', { name: 'Cambiar roles: Ana Pérez' }))

    const save = screen.getByRole('button', { name: 'Guardar roles' })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Interesado' }))
    expect(save).toBeDisabled()
    expect(screen.getByText('Elige al menos un rol.')).toBeInTheDocument()
  })

  it('shows the error in the row and keeps the panel open', async () => {
    routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, pageOf(ana())),
      [`PUT /api/v1/users/${ANA_ID}/roles`]: () =>
        jsonResponse(
          403,
          problem(403, 'USER_ADMIN_REQUIRED', 'Solo un administrador puede hacer esto.'),
        ),
    })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await user.click(await screen.findByRole('button', { name: 'Cambiar roles: Ana Pérez' }))
    await user.click(screen.getByRole('checkbox', { name: 'Agente' }))
    await user.click(screen.getByRole('button', { name: 'Guardar roles' }))

    expect(
      await within(rowOf('Ana Pérez')).findByText('Solo un administrador puede hacer esto.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar roles' })).toBeInTheDocument()
  })

  it('asks for confirmation before deactivating an account', async () => {
    let current = ana()
    const path = `/api/v1/users/${ANA_ID}/deactivate`
    const fetchMock = routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, pageOf(current)),
      [`POST ${path}`]: () => {
        current = ana({ active: false })
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await user.click(await screen.findByRole('button', { name: 'Desactivar: Ana Pérez' }))
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(path))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    expect(await within(rowOf('Ana Pérez')).findByText('Desactivada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar: Ana Pérez' })).toBeInTheDocument()
  })

  it('activates a deactivated account', async () => {
    let current = ana({ active: false })
    routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(200, pageOf(current)),
      [`POST /api/v1/users/${ANA_ID}/activate`]: () => {
        current = ana()
        return jsonResponse(204)
      },
    })
    const user = userEvent.setup()

    renderApp('/admin/users')
    await user.click(await screen.findByRole('button', { name: 'Activar: Ana Pérez' }))

    expect(await within(rowOf('Ana Pérez')).findByText('Activa')).toBeInTheDocument()
  })

  it('does not offer an administrator to lock themselves out', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf(self())) })
    const user = userEvent.setup()

    renderApp('/admin/users')

    expect(await screen.findByRole('heading', { name: 'Admin Demo (tú)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Desactivar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cambiar roles: Admin Demo' }))
    expect(screen.getByRole('checkbox', { name: 'Administrador' })).toBeDisabled()
  })

  it('shows an error with a retry when the list fails', async () => {
    routeFetch({
      ...base(),
      [LIST]: () => jsonResponse(500, problem(500, 'INTERNAL_ERROR', 'Ocurrió un error.')),
    })

    renderApp('/admin/users')

    expect(await screen.findByText('No se pudieron cargar los usuarios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('says so when no account has the chosen role', async () => {
    routeFetch({ ...base(), [LIST]: () => jsonResponse(200, pageOf()) })

    renderApp('/admin/users?role=AGENT')

    expect(await screen.findByText('No hay usuarios con ese rol')).toBeInTheDocument()
  })
})
