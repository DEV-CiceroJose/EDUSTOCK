import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import MerendaPage from "./MerendaPage"
import { ToastProvider } from "../components/ui/Toast"
import { useDashboardData } from "../hooks/useDashboardData"
import { operacaoApi } from "../api"

vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: vi.fn(),
}))

vi.mock("../api", () => ({
  operacaoApi: {
    planoDoDia: vi.fn(),
    baixaProducao: vi.fn(),
    resumo: vi.fn(),
    registrarContagem: vi.fn(),
  },
}))

describe("MerendaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDashboardData).mockReturnValue({
      produtos: [],
      loading: false,
      error: null,
      carregar: vi.fn(),
    })
    vi.mocked(operacaoApi.planoDoDia).mockResolvedValue({
      data: "2026-09-10",
      refeicao: "ALMOCO",
      refeicao_label: "Almoço",
      total_alunos: 0,
      previsao: { total_alunos: 0, alerta_reducao: false },
      itens: [],
      baixa_realizada: false,
      status_baixa: null,
    })
    vi.mocked(operacaoApi.resumo).mockResolvedValue({
      data: "2026-09-10",
      total_alunos: 0,
      media_historica: 0,
      variacao_pct: null,
      alerta_reducao: false,
      turmas: [],
    })
  })

  it("abre diretamente a produção quando a URL solicita essa visão", async () => {
    render(
      <MemoryRouter initialEntries={["/merenda?view=producao"]}>
        <ToastProvider>
          <MerendaPage />
        </ToastProvider>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole("heading", { name: "Produção do dia" }),
    ).toBeInTheDocument()
  })
})
