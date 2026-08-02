import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContagemView from './ContagemView.jsx'
import PinLogin from './PinLogin.jsx'
import { getSessao, getStatusDoDia, limparSessao, registrarContagem } from './api.js'

vi.mock('./api.js', () => ({
  getSessao: vi.fn(),
  getStatusDoDia: vi.fn(),
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
    getSessao.mockReturnValue({ turma: '6A', turno: 'INTEGRAL' })
    getStatusDoDia.mockResolvedValue({
      perfil: 'ALUNO_REP',
      turma: '6A',
      turno: 'INTEGRAL',
      frequencia_registrada: false,
      frequencia: null,
      sincronizado_em: '2026-08-02T12:00:00-03:00',
    })
  })

  it('mostra o ícone de sucesso sem emoji ao confirmar a contagem', async () => {
    registrarContagem.mockResolvedValue({
      turma: '6A',
      turno: 'INTEGRAL',
      quantidade_alunos: 30,
      previsao: null,
    })

    renderView()
    await screen.findByRole('button', { name: 'Confirmar' })

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
    await screen.findByRole('button', { name: 'Confirmar' })

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    const botaoConfirmar = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.click(botaoConfirmar)
    fireEvent.click(botaoConfirmar)

    resolverContagem({ turma: '6A', turno: 'INTEGRAL', quantidade_alunos: 3, previsao: null })
    await waitFor(() => expect(registrarContagem).toHaveBeenCalledTimes(1))
  })

  it('encerra a sessão e pede o PIN novamente quando o token expira', async () => {
    const erro = new Error('Token expirado')
    erro.status = 401
    registrarContagem.mockRejectedValue(erro)

    renderComRotas()
    await screen.findByRole('button', { name: 'Confirmar' })

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Sua sessão expirou. Digite o PIN novamente.')).toBeInTheDocument()
    expect(limparSessao).toHaveBeenCalledTimes(1)
  })

  it('mostra uma orientação clara quando a conexão falha', async () => {
    registrarContagem.mockRejectedValue(new TypeError('Failed to fetch'))

    renderView()
    await screen.findByRole('button', { name: 'Confirmar' })
    await screen.findByRole('button', { name: 'Confirmar' })

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem conexão com o sistema. Verifique a internet e tente novamente.',
    )
  })

  it('não permite enviar mais de 45 alunos', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Confirmar' })

    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '6' }))

    expect(screen.getByRole('alert')).toHaveTextContent('O limite permitido é 45 alunos.')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(registrarContagem).not.toHaveBeenCalled()
  })

  it('mostra a contagem já registrada sem permitir um segundo envio', async () => {
    getStatusDoDia.mockResolvedValue({
      perfil: 'ALUNO_REP',
      turma: '6A',
      turno: 'INTEGRAL',
      frequencia_registrada: true,
      frequencia: { quantidade_alunos: 28, registrada_em: '2026-08-02T08:15:00-03:00' },
      sincronizado_em: '2026-08-02T12:00:00-03:00',
    })

    renderView()

    expect(await screen.findByText('A frequência desta turma já foi enviada hoje.')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })
})
