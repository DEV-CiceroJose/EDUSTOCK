import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-alunos)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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

  it('chama login apenas com o PIN ao completar os 4 dígitos', async () => {
    const { login } = await import('./api.js')
    login.mockResolvedValue({ token: 'abc', turma: '1º DS-A', turno: 'INTEGRAL' })
    const { default: PinLogin } = await import('./PinLogin.jsx')

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

  it('mostra erro do backend sem travar a interface quando o PIN não é reconhecido', async () => {
    const { login } = await import('./api.js')
    login.mockRejectedValue(new Error('PIN inválido.'))
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['0', '0', '0', '0'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(await screen.findByText('PIN inválido.')).toBeInTheDocument()
  })
})
