import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContagemView from './ContagemView.jsx'
import { getSessao, registrarContagem } from './api.js'

vi.mock('./api.js', () => ({
  getSessao: vi.fn(),
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
})
