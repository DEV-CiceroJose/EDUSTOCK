import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import KitchenProductionView from "./KitchenProductionView"
import { ToastProvider } from "../../components/ui/Toast"
import { operacaoApi } from "../../api"

vi.mock("../../api", () => ({
  operacaoApi: {
    planoDoDia: vi.fn(),
    baixaProducao: vi.fn(),
  },
}))

describe("KitchenProductionView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0, 0))
    operacaoApi.planoDoDia.mockResolvedValue({
      data: "2026-09-10",
      refeicao: "ALMOCO",
      refeicao_label: "Almoço",
      total_alunos: 0,
      previsao: { total_alunos: 0, alerta_reducao: false },
      itens: [],
      baixa_realizada: false,
      status_baixa: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("consulta o almoço pela data local e mostra refeições em vez de turnos", async () => {
    render(
      <ToastProvider>
        <KitchenProductionView />
      </ToastProvider>,
    )

    await waitFor(() => {
      expect(operacaoApi.planoDoDia).toHaveBeenCalledWith({
        data: "2026-09-10",
        refeicao: "ALMOCO",
      })
    })

    expect(screen.getByRole("button", { name: "Café da manhã" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Almoço" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lanche da tarde" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Integral" })).not.toBeInTheDocument()
  })
})
