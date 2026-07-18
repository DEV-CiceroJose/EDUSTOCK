import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import { login } from './api.js'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-cozinha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o ícone ChefHat no cabeçalho, sem emoji', () => {
    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.queryByText('🍽️')).not.toBeInTheDocument()
  })

  it('chama login ao completar os 4 dígitos do PIN', () => {
    login.mockResolvedValue({ token: 'abc' })

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['1', '2', '3', '4'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(login).toHaveBeenCalledWith('1234')
  })
})
