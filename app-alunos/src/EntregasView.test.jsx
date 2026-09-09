import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import EntregasView from './EntregasView'
import { confirmarEntrega, listarEntregas } from './api'

vi.mock('./api', () => ({
  getSessao: () => ({ turma: '1 A', escola: { nome: 'Escola A' } }),
  listarEntregas: vi.fn(), confirmarEntrega: vi.fn(), limparSessao: vi.fn(), logout: vi.fn(),
}))
const alvo = { id: 1, aluno_id: 5, nome: 'Ana', turma_nome: '1 A', serie: '1', rodada_id: 2, rodada_titulo: 'Setembro', entregue_em: null }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  vi.clearAllMocks()
  listarEntregas.mockResolvedValue({ rodadas: [{ id: 2, titulo: 'Setembro', itens: [] }], alunos: [alvo] })
})

it('pede confirmação nominal e troca botão por comprovante após sucesso', async () => {
  confirmarEntrega.mockResolvedValue({ ...alvo, entregue_em: '2026-09-06T12:00:00Z' })
  render(<MemoryRouter><EntregasView /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
  expect(confirmarEntrega).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toHaveTextContent('Ana · #5')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
  await screen.findByText(/Entrega registrada para Ana/)
  expect(confirmarEntrega).toHaveBeenCalledExactlyOnceWith(1)
  expect(screen.queryByRole('button', { name: 'Registrar entrega' })).not.toBeInTheDocument()
})

it('falha de conexão não marca como entregue', async () => {
  confirmarEntrega.mockRejectedValue(new TypeError('offline'))
  render(<MemoryRouter><EntregasView /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Sem conexão'))
  expect(screen.queryByText(/Entrega registrada para Ana/)).not.toBeInTheDocument()
})
