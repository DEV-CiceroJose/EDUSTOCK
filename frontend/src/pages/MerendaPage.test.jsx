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
    historicoFrequencia: vi.fn(),
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
    vi.mocked(operacaoApi.historicoFrequencia).mockResolvedValue({
      data: "2026-09-25",
      total_alunos: 31,
      turmas_registradas: 1,
      turmas_esperadas: 12,
      registros: [{ id: 1, turma: "1º DS-A", turno_label: "Integral", quantidade_alunos: 31 }],
      turmas_sem_registro: ["1º DS-B"],
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

  it("abre o relatório histórico por turma", async () => {
    render(
      <MemoryRouter initialEntries={["/merenda?view=historico"]}>
        <ToastProvider><MerendaPage /></ToastProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Histórico de presença por turma" })).toBeInTheDocument()
    expect(screen.getByText("1º DS-A")).toBeInTheDocument()
    expect(screen.getAllByText("31")).toHaveLength(2)
  })
})
