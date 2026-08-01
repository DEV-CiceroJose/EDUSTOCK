import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContagemView from './ContagemView.jsx'
import PinLogin from './PinLogin.jsx'
import { getSessao, limparSessao, registrarContagem } from './api.js'

vi.mock('./api.js', () => ({
  getSessao: vi.fn(),
  limparSessao: vi.fn(),
  login: vi.fn(),
  registrarContagem: vi.fn(),
  logout: vi.fn(),
}))

function renderView() {
  return render(
    <MemoryRouter>
      <ContagemView />
    </MemoryRouter>
  )
}

function renderComRotas() {
  return render(
    <MemoryRouter initialEntries={['/registrar']}>
      <Routes>
        <Route path="/registrar" element={<ContagemView />} />
        <Route path="/login" element={<PinLogin />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ContagemView (app-alunos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessao.mockReturnValue({ turma: '6A', turno: 'MANHA' })
  })

  it('mostra o ícone de sucesso sem emoji ao confirmar a contagem', async () => {
    registrarContagem.mockResolvedValue({
      turma: '6A',
      turno: 'MANHA',
      quantidade_alunos: 30,
      previsao: null,
    })

    renderView()

    ;['3', '0'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByTestId('icone-sucesso')).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('não envia registrarContagem duas vezes em cliques duplos', async () => {
    let resolverContagem
    registrarContagem.mockReturnValue(new Promise((resolve) => { resolverContagem = resolve }))

    renderView()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    const botaoConfirmar = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.click(botaoConfirmar)
    fireEvent.click(botaoConfirmar)

    resolverContagem({ turma: '6A', turno: 'MANHA', quantidade_alunos: 3, previsao: null })
    await waitFor(() => expect(registrarContagem).toHaveBeenCalledTimes(1))
  })

  it('encerra a sessão e pede o PIN novamente quando o token expira', async () => {
    const erro = new Error('Token expirado')
    erro.status = 401
    registrarContagem.mockRejectedValue(erro)

    renderComRotas()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Sua sessão expirou. Digite o PIN novamente.')).toBeInTheDocument()
    expect(limparSessao).toHaveBeenCalledTimes(1)
  })

  it('mostra uma orientação clara quando a conexão falha', async () => {
    registrarContagem.mockRejectedValue(new TypeError('Failed to fetch'))

    renderView()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem conexão com o sistema. Verifique a internet e tente novamente.',
    )
  })

  it('não permite enviar mais de 45 alunos', () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '6' }))

    expect(screen.getByRole('alert')).toHaveTextContent('O limite permitido é 45 alunos.')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(registrarContagem).not.toHaveBeenCalled()
  })
})
