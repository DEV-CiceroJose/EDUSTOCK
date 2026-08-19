import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import { login } from './api.js'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-cozinha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('mostra o ícone Phosphor no cabeçalho, sem emoji', () => {
    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'EduStock Cozinha' })).toBeInTheDocument()
    expect(screen.queryByText('🍽️')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
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

  it('bloqueia o teclado quando o dispositivo está sem conexão', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByText('Sem conexão. Conecte o dispositivo à internet para entrar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
  })
})
