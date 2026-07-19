import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProducaoView from './ProducaoView.jsx'
import { getPlano, baixaProducao } from './api.js'

vi.mock('./api.js', () => ({
  getPlano: vi.fn(),
  baixaProducao: vi.fn(),
  logout: vi.fn(),
}))

const PLANO_BASE = {
  data: '2026-07-17',
  turno: 'MANHA',
  total_alunos: 120,
  previsao: null,
  itens: [
    {
      produto_id: 1,
      produto_nome: 'Arroz',
      categoria_nome: 'Alimentos',
      unidade: 'KG',
      quantidade: '5.000',
      quantidade_legivel: '5,0 kg',
      saldo_atual: '20.000',
      estoque_insuficiente: false,
    },
  ],
}

function renderView() {
  return render(
    <MemoryRouter>
      <ProducaoView />
    </MemoryRouter>
  )
}

describe('ProducaoView (app-cozinha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlano.mockResolvedValue(PLANO_BASE)
  })

  it('mostra o ícone de categoria correto e nenhum emoji', async () => {
    renderView()

    expect(await screen.findByTestId('icone-categoria-alimento')).toBeInTheDocument()
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument()
    expect(screen.queryByText('✅')).not.toBeInTheDocument()
  })

  it('não envia baixaProducao duas vezes em cliques duplos', async () => {
    let resolverBaixa
    baixaProducao.mockReturnValue(new Promise((resolve) => { resolverBaixa = resolve }))

    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))
    const botaoConfirmar = await screen.findByRole('button', { name: /Dar baixa/ })

    fireEvent.click(botaoConfirmar)
    fireEvent.click(botaoConfirmar)

    resolverBaixa({ data: '2026-07-17', turno: 'MANHA', resultados: [], sucesso: 1, falhas: 0 })
    await waitFor(() => expect(baixaProducao).toHaveBeenCalledTimes(1))
  })

  it('em falha de rede, mostra aviso e recarrega o plano automaticamente', async () => {
    baixaProducao.mockRejectedValue(new TypeError('Failed to fetch'))

    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))
    fireEvent.click(await screen.findByRole('button', { name: /Dar baixa/ }))

    await waitFor(() => {
      expect(document.body.textContent).toContain('O plano foi recarregado')
    })
    expect(getPlano).toHaveBeenCalledTimes(2)
  })
})
