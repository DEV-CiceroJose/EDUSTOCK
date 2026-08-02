import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ContagemView from "./ContagemView"
import { operacaoApi } from "../../api"

vi.mock("../../api", () => ({
  operacaoApi: { registrarContagem: vi.fn() },
}))

describe("ContagemView", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mostra diretamente as turmas sem filtros de período", () => {
    render(<ContagemView />)

    expect(screen.queryByRole("button", { name: "Manhã" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tarde" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Integral" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Total" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2º DS-A" })).toBeInTheDocument()
  })

  it("registra qualquer turma automaticamente como integral", async () => {
    const user = userEvent.setup()
    operacaoApi.registrarContagem.mockResolvedValue({
      previsao: { total_alunos: 20, alerta_reducao: false },
    })

    render(<ContagemView />)

    await user.click(screen.getByRole("button", { name: "2º DS-A" }))
    await user.click(screen.getByRole("button", { name: "2" }))
    await user.click(screen.getByRole("button", { name: "0" }))
    await user.click(screen.getByRole("button", { name: "✓" }))

    await waitFor(() => {
      expect(operacaoApi.registrarContagem).toHaveBeenCalledWith({
        turma: "2º DS-A",
        turno: "INTEGRAL",
        quantidade_alunos: 20,
      })
    })
    expect(await screen.findByText("Total do dia: 20 alunos")).toBeInTheDocument()
  })
})
