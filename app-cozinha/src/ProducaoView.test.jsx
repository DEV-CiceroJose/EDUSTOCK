import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProducaoView from './ProducaoView.jsx'
import { baixaProducao, consultarBaixa, getPlano } from './api.js'

vi.mock('./api.js', () => ({
  getPlano: vi.fn(),
  baixaProducao: vi.fn(),
  consultarBaixa: vi.fn(),
  obterOperacaoPendente: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
  concluirOperacaoPendente: vi.fn(),
  limparSessao: vi.fn(),
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
    const naoEncontrada = new Error('Operação não encontrada')
    naoEncontrada.status = 404
    consultarBaixa.mockRejectedValue(naoEncontrada)
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
      expect(document.body.textContent).toContain('tentar novamente com segurança')
    })
    expect(getPlano).toHaveBeenCalledTimes(2)
  })

  it('recupera o resultado pelo identificador quando a resposta da baixa se perde', async () => {
    baixaProducao.mockRejectedValue(new TypeError('Failed to fetch'))
    consultarBaixa.mockResolvedValue({
      operacao_id: '11111111-1111-4111-8111-111111111111',
      resultados: [],
      sucesso: 1,
      falhas: 0,
      repetida: true,
    })

    renderView()
    await screen.findByTestId('icone-categoria-alimento')
    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))
    fireEvent.click(await screen.findByRole('button', { name: /Dar baixa/ }))

    expect(await screen.findByText('Resultado recuperado sem repetir movimentações.')).toBeInTheDocument()
    expect(consultarBaixa).toHaveBeenCalledTimes(1)
    expect(getPlano).toHaveBeenCalledTimes(1)
  })

  it('mostra data, turno e itens no diálogo de confirmação', async () => {
    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa de Produção' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar baixa de produção' })
    expect(dialogo).toHaveTextContent('17/07/2026 · Manhã')
    expect(dialogo).toHaveTextContent('Arroz')
    expect(dialogo).toHaveTextContent('5,0 kg')
  })

  it('permite atualizar o plano manualmente e informa a sincronização', async () => {
    renderView()
    await screen.findByTestId('icone-categoria-alimento')

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await waitFor(() => expect(getPlano).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Última atualização:/)).toBeInTheDocument()
  })
})
