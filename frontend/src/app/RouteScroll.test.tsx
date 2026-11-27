import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RouteScroll } from './components/RouteScroll'

function NavigationExample() {
  const navigate = useNavigate()
  return (
    <>
      <RouteScroll />
      <Link to="/">Catálogo</Link>
      <Link to="/?sort=price,asc">Ordenar por precio</Link>
      <button onClick={() => navigate(-1)}>Atrás</button>
    </>
  )
}

describe('Position when changing screens', () => {
  it('shows the start of a new screen but does not jump when changing its filters', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/properties/example']}>
        <NavigationExample />
      </MemoryRouter>,
    )
    document.documentElement.scrollTop = 420
    await user.click(screen.getByRole('link', { name: 'Catálogo' }))
    expect(document.documentElement.scrollTop).toBe(0)
    document.documentElement.scrollTop = 300
    await user.click(screen.getByRole('link', { name: 'Ordenar por precio' }))
    expect(document.documentElement.scrollTop).toBe(300)
  })

  it('does not override the browser position when navigating back', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/', '/properties/example']} initialIndex={1}>
        <NavigationExample />
      </MemoryRouter>,
    )
    document.documentElement.scrollTop = 450
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(document.documentElement.scrollTop).toBe(450)
    document.documentElement.scrollTop = 0
  })
})
