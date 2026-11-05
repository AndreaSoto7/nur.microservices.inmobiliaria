import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { tokenStore } from '../core/auth/tokenStore'
import { currentUser, jsonResponse, mockFetch, problem, tokens } from '../test/http'
import { renderApp } from '../test/renderApp'

describe('flujo de sesión', () => {
  it('manda a login al entrar a una ruta protegida sin sesión', async () => {
    mockFetch()

    renderApp('/cuenta')

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('después de ingresar vuelve a la ruta protegida y muestra el perfil', async () => {
    const fetchMock = mockFetch(jsonResponse(200, tokens()), jsonResponse(200, currentUser))
    const user = userEvent.setup()
    renderApp('/cuenta')

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/auth/login')
    expect(tokenStore.getRefreshToken()).toBe('refresh-1')
  })

  it('muestra el detail del problem+json si las credenciales son inválidas', async () => {
    mockFetch(
      jsonResponse(
        401,
        problem(401, 'AUTH_INVALID_CREDENTIALS', 'Email o contraseña incorrectos.'),
      ),
    )
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
  })

  it('recupera la sesión al recargar si hay un refresh token guardado', async () => {
    localStorage.setItem('inmobiliaria.refreshToken', 'refresh-guardado')
    mockFetch(jsonResponse(200, tokens('nuevo')), jsonResponse(200, currentUser))

    renderApp('/cuenta')

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
  })

  it('registra la cuenta con el rol elegido e inicia sesión', async () => {
    const fetchMock = mockFetch(
      jsonResponse(201, { id: currentUser.id }),
      jsonResponse(200, tokens()),
      jsonResponse(200, { ...currentUser, roles: ['AGENT'] }),
    )
    const user = userEvent.setup()
    renderApp('/registro')

    await fillRegisterForm(user)

    expect(await screen.findByText('Hola, Ana Pérez')).toBeInTheDocument()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      fullName: 'Ana Pérez',
      email: 'ana@example.com',
      role: 'AGENT',
    })
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8080/api/v1/auth/login')
  })

  it('muestra junto al campo el error de validación que devuelve la API', async () => {
    mockFetch(
      jsonResponse(400, {
        ...problem(400, 'VALIDATION_ERROR', 'Uno o más campos no son válidos.'),
        errors: [{ field: 'email', message: 'Introduzca un email válido.' }],
      }),
    )
    const user = userEvent.setup()
    renderApp('/registro')

    await fillRegisterForm(user)

    expect(await screen.findByText('Introduzca un email válido.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})

async function fillRegisterForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nombre completo'), 'Ana Pérez')
  await user.type(screen.getByLabelText('Email'), 'ana@example.com')
  await user.type(screen.getByLabelText(/Contraseña/), '12345678')
  await user.click(screen.getByLabelText('Soy agente y publico propiedades'))
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}
