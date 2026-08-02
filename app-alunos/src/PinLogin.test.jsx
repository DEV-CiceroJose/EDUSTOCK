import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import { login } from './api.js'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-alunos)', () => {
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
    expect(screen.getByRole('heading', { name: 'EduStock Alunos' })).toBeInTheDocument()
    expect(screen.queryByText('🏫')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeDisabled()
  })

  it('chama login apenas com o PIN ao completar os 4 dígitos', () => {
    login.mockResolvedValue({ token: 'abc', turma: '1º DS-A', turno: 'INTEGRAL' })

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
    login.mockRejectedValue(new Error('PIN inválido.'))

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

  it('explica quando uma sessão anterior expirou', () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { message: 'Sua sessão expirou. Digite o PIN novamente.' },
      }]}>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByText('Sua sessão expirou. Digite o PIN novamente.')).toBeInTheDocument()
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
