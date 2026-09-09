import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import DistribuicaoPage from './DistribuicaoPage'
import { distribuicao } from '../api/distribuicao'

vi.mock('../api/distribuicao', () => ({ distribuicao: vi.fn() }))
vi.mock('../lib/auth', () => ({ getEscola: () => ({ nome: 'Escola A' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  distribuicao.mockImplementation(async path => {
    if (path === '/alunos/') return { alunos: [], turmas: [{ id: 1, nome: '1 A' }], produtos: [], total_ativos: 0, por_turma: [] }
    if (path === '/rodadas/') return [{ id: 2, titulo: 'Setembro', tipo: 'KIT_ESCOLAR', estado: 'RASCUNHO', itens: [], total: 0, entregues: 0 }]
    if (path.startsWith('/relatorio/')) return { escola: 'Escola A', total: 2, entregues: 1, pendentes: 1, percentual: 50, resultados: [{ id: 1, nome: 'Ana', aluno_id: 4, rodada_titulo: 'Setembro', tipo: 'KIT_ESCOLAR', turma_nome: '1 A', serie: '1', entregue_em: null }] }
  })
})

it('gera relatório com pendentes e exporta os mesmos filtros', async () => {
  render(<DistribuicaoPage />)
  await screen.findByText('0 alunos ativos na escola')
  fireEvent.click(screen.getByRole('button', { name: 'Relatório', exact: true }))
  fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'PENDENTE' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gerar relatório' }))
  await screen.findByText('Ana · #4')
  expect(screen.getByText(/2 entregas previstas/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
  await waitFor(() => expect(distribuicao).toHaveBeenCalledWith('/relatorio/?situacao=PENDENTE&exportar=csv', { download: 'relatorio-entregas.csv' }))
})

it('prévia com erros não permite confirmar a importação', async () => {
  render(<DistribuicaoPage />)
  await screen.findByText('0 alunos ativos na escola')
  distribuicao.mockResolvedValueOnce({ novos: 1, ignorados: 0, erros: ['Linha 3 inválida'], avisos: [], previa: [], token: null })
  fireEvent.change(screen.getByLabelText('Planilha de alunos'), { target: { files: [new File(['nome;turma;serie;sexo'], 'alunos.csv')] } })
  await screen.findByText('Linha 3 inválida')
  expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
})

it('informa falha de permissão sem exibir cadastro', async () => {
  distribuicao.mockRejectedValue(new Error('Somente a gestão da escola'))
  render(<DistribuicaoPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Somente a gestão da escola')
  expect(screen.queryByText('Cadastro individual')).not.toBeInTheDocument()
})
