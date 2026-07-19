import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-alunos)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_PINS', '6A:1234')
    vi.stubEnv('VITE_TURNOS', '6A:MANHA')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mostra o ícone School no cabeçalho, sem emoji', async () => {
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.queryByText('🏫')).not.toBeInTheDocument()
  })

  it('chama login com a turma certa ao completar os 4 dígitos do PIN', async () => {
    const { login } = await import('./api.js')
    login.mockResolvedValue({ token: 'abc', turma: '6A', turno: 'MANHA' })
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['1', '2', '3', '4'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(login).toHaveBeenCalledWith('1234', '6A', 'MANHA')
  })
})
