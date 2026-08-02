import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ContagemWidget from "./ContagemWidget"
import { operacaoApi } from "../../api"

vi.mock("../../api", () => ({
  operacaoApi: { resumo: vi.fn() },
}))

describe("ContagemWidget", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mostra o histórico diário separado por turma", async () => {
    operacaoApi.resumo.mockResolvedValue({
      total_alunos: 58,
      media_historica: 38,
      variacao_pct: 52.6,
      alerta_reducao: false,
      turmas: [
        { turma: "1º DS-A", quantidade_alunos: 20 },
        { turma: "2º DS-A", quantidade_alunos: 38 },
      ],
    })

    render(<ContagemWidget />)

    expect(await screen.findByText("Turmas registradas hoje")).toBeInTheDocument()
    expect(screen.getByText("1º DS-A")).toBeInTheDocument()
    expect(screen.getByText("20 alunos")).toBeInTheDocument()
    expect(screen.getByText("2º DS-A")).toBeInTheDocument()
    expect(screen.getByText("38 alunos")).toBeInTheDocument()
  })

  it("informa quando nenhuma turma registrou presença", async () => {
    operacaoApi.resumo.mockResolvedValue({
      total_alunos: 0,
      media_historica: 0,
      variacao_pct: null,
      alerta_reducao: false,
      turmas: [],
    })

    render(<ContagemWidget />)

    expect(await screen.findByText("Nenhuma turma registrou presença hoje.")).toBeInTheDocument()
  })
})
