import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MovimentacoesView from "./MovimentacoesView"
import { salvarSessao } from "../../lib/auth"

const { estornar } = vi.hoisted(() => ({ estornar: vi.fn() }))

vi.mock("../../api", () => ({
  movimentacoesApi: { estornar },
}))

describe("MovimentacoesView - estorno", () => {
  const movimento = {
    id: 7, produto: 1, produto_nome: "Arroz", tipo: "SAIDA",
    quantidade: "2.000", motivo: "consumo", data: "2026-08-08",
  }

  beforeEach(() => {
    sessionStorage.clear()
    estornar.mockReset()
  })

  it("permite ao administrador estornar com motivo e recarrega os dados", async () => {
    salvarSessao({ token: "token", papel: "ADMIN", is_staff: false, modulos_ativos: [] })
    estornar.mockResolvedValue({ id: 8 })
    const onAtualizar = vi.fn().mockResolvedValue(undefined)
    render(<MovimentacoesView movimentacoes={[movimento]} onNovaEntrada={vi.fn()} onNovaSaida={vi.fn()} onAtualizar={onAtualizar} />)

    fireEvent.click(screen.getByRole("button", { name: /estornar/i }))
    fireEvent.change(screen.getByLabelText(/motivo do estorno/i), { target: { value: "lançamento incorreto" } })
    fireEvent.click(screen.getByRole("button", { name: /^confirmar estorno$/i }))

    await waitFor(() => expect(estornar).toHaveBeenCalledWith(7, "lançamento incorreto"))
    await waitFor(() => expect(onAtualizar).toHaveBeenCalled())
  })

  it("não exibe a ação de estorno para operador", () => {
    salvarSessao({ token: "token", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    render(<MovimentacoesView movimentacoes={[movimento]} onNovaEntrada={vi.fn()} onNovaSaida={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /estornar/i })).not.toBeInTheDocument()
  })
})
